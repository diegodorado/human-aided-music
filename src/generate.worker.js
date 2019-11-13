import {MusicVAE} from "@magenta/music/node/music_vae"
import {MusicRNN} from "@magenta/music/node/music_rnn"
import {NoteSequence} from "@magenta/music/node/protobuf"
import {sequences} from "@magenta/music/node/core"

const CHECKPOINTS_DIR = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/'
const TAP2DRUM_CKPT = `${CHECKPOINTS_DIR}groovae_tap2drum_2bar`
const DRUM2BAR_CKPT = `${CHECKPOINTS_DIR}drums_2bar_lokl_small`
const GROOVE2BAR_CKPT = `${CHECKPOINTS_DIR}groovae_2bar_humanize`
const DRUM_RNN_CKPT = `https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/drum_kit_rnn`



const tapVae = new MusicVAE(TAP2DRUM_CKPT)
const drumVae = new MusicVAE(DRUM2BAR_CKPT)
const grooVae = new MusicVAE(GROOVE2BAR_CKPT)
const continueRNN = new MusicRNN(DRUM_RNN_CKPT)
const stepsPerQuarter = 4
let prev_ns = null

let initialized = false

// initialize all models
Promise.all([
    drumVae.initialize(),
    tapVae.initialize(),
    grooVae.initialize(),
    continueRNN.initialize(),
  ]).then( () => initialized = true)


// receive a note sequence, and return another one
self.addEventListener('message', (ev)=>{
  if(!initialized )
    return postMessage({msg: 'Not ready yet'})


  try {
    const {destination} = ev.data
    process(ev.data).then( (ns) => {
      prev_ns = ns
      postMessage({ns, destination})
    })

  } catch (err) {
    console.error(err);
  }
})



async function process(data) {

  const {qpm,temperature,strategy, notes, timeOffset, destination} = data
  // Shift the sequence back to time 0
  notes.forEach(n => {
     n.startTime -= timeOffset
     n.endTime -= timeOffset
  })

  const ns = NoteSequence.create({notes, tempos:[{qpm}]})

  switch (strategy) {
    case 'generate':
      return await generateDrum(ns,temperature, stepsPerQuarter, qpm)
    case 'generate_groove':
      return await generateDrumWithGroove(ns,temperature, stepsPerQuarter, qpm)
    case 'groove':
      return await groove(ns,temperature, stepsPerQuarter, qpm)
    case 'tap2drum':
      return await tap2Drum(ns,temperature, stepsPerQuarter, qpm)
    case 'continue':
      return await continueBeat(prev_ns,temperature, stepsPerQuarter, qpm)
    case 'continue_groove':
      return await continueGroove(prev_ns,temperature, stepsPerQuarter, qpm)
    case 'tap_or_continue':
      if(notes.length===0){
        return await continueBeat(prev_ns,temperature, stepsPerQuarter, qpm)
      }
      else{
        return await tap2Drum(ns,temperature, stepsPerQuarter, qpm)
      }
    default:
      break;
  }
}



async function tap2Drum(ns,temperature, stepsPerQuarter, qpm) {
  const ts = tapVae.dataConverter.toTensor(ns)
  const input = await tapVae.dataConverter.toNoteSequence(ts)
  const z = await tapVae.encode([input])
  const decoded = await tapVae.decode(z,temperature, null, stepsPerQuarter, qpm)
  return decoded[0]
}



async function generateDrum(ns,temperature, stepsPerQuarter, qpm) {
  const sample = await drumVae.sample(1, temperature, null, stepsPerQuarter, qpm)
  return sequences.unquantizeSequence(sample[0],qpm)
}


async function generateDrumWithGroove(ns,temperature, stepsPerQuarter, qpm) {
  const sample = await drumVae.sample(1, temperature, null, stepsPerQuarter, qpm)
  const z = await grooVae.encode(sample)
  const decoded = await grooVae.decode(z,temperature, null, stepsPerQuarter, qpm)
  return decoded[0]
}


async function groove(ns,temperature, stepsPerQuarter, qpm) {
  const sample = await grooVae.sample(1, temperature, null, stepsPerQuarter, qpm)
  return sample[0]
}



async function continueBeat(ns,temperature, stepsPerQuarter, qpm) {
  ns.totalTime = 8
  const qns = sequences.quantizeNoteSequence(ns,stepsPerQuarter)
  const result = await continueRNN.continueSequence(qns, 32, temperature)
  return sequences.unquantizeSequence(result,qpm)
}



async function continueGroove(ns,temperature, stepsPerQuarter, qpm) {
  ns.totalTime = 8
  const qns = sequences.quantizeNoteSequence(ns,stepsPerQuarter)
  const cont = await continueRNN.continueSequence(qns, 32, temperature)
  const z = await grooVae.encode([cont])
  const decoded = await grooVae.decode(z,temperature, null, stepsPerQuarter, qpm)
  return decoded[0]
}
