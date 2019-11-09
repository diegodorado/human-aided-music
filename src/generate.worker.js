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
    const {qpm,temperature,strategy, notes, timeOffset, destination} = ev.data
    // Shift the sequence back to time 0
    notes.forEach(n => {
       n.startTime -= timeOffset
       n.endTime -= timeOffset
    })

    const ns = NoteSequence.create({notes})

    switch (strategy) {
      case 'generate':
        generateDrum(ns,temperature, stepsPerQuarter, qpm)
          .then((ns) => postMessage({ns, destination}))
        break;
      case 'generate_groove':
        generateDrumWithGroove(ns,temperature, stepsPerQuarter, qpm)
          .then((ns) => postMessage({ns, destination}))
        break;
      case 'groove':
        groove(ns,temperature, stepsPerQuarter, qpm)
          .then((ns) => postMessage({ns, destination}))
        break;
      case 'tap2drum':
        tap2Drum(ns,temperature, stepsPerQuarter, qpm)
          .then((ns) => postMessage({ns, destination}))
        break;
      case 'continue':
        continueBeat(ns,temperature, stepsPerQuarter, qpm)
          .then((ns) => postMessage({ns, destination}))
        break;
      case 'continue_groove':
        continueGroove(ns,temperature, stepsPerQuarter, qpm)
          .then((ns) => postMessage({ns, destination}))
        break;
      default:
        break;
    }

  } catch (err) {
    console.error(err);
  }
})

async function tap2Drum(ns,temperature, stepsPerQuarter, qpm) {
  const ts = tapVae.dataConverter.toTensor(ns)
  const input = await tapVae.dataConverter.toNoteSequence(ts)
  const z = await tapVae.encode([input])
  const decoded = await tapVae.decode(z,temperature, null, stepsPerQuarter, qpm)
  return decoded[0]
}



async function generateDrum(ns,temperature, stepsPerQuarter, qpm) {
  const sample = await drumVae.sample(1, temperature, null, stepsPerQuarter, qpm)
  return sequences.unquantizeSequence(sample[0])
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
  return sequences.unquantizeSequence(result)
}



async function continueGroove(ns,temperature, stepsPerQuarter, qpm) {
  ns.totalTime = 8
  const qns = sequences.quantizeNoteSequence(ns,stepsPerQuarter)
  const cont = await continueRNN.continueSequence(qns, 32, temperature)
  const z = await grooVae.encode([cont])
  const decoded = await grooVae.decode(z,temperature, null, stepsPerQuarter, qpm)
  return decoded[0]
}
