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
let repeatingFor = 0
let initialized = false
let interp = null
let interpolatingFor = 0
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
    const {destination, repeatFor,interpolateFor,strategy} = ev.data


    if(strategy==='interpolate' && interp && interpolateFor>0 && interpolatingFor++<interpolateFor){
      const qns = sequences.quantizeNoteSequence(interp[interpolatingFor-1],stepsPerQuarter)
      postMessage({ns: interp[interpolatingFor-1],qns, destination})
      console.log(`interpolate step ${interpolatingFor} of ${interpolateFor}`)
    }
    else if(strategy!=='interpolate' && prev_ns && repeatFor>0 && repeatingFor++<repeatFor){
      const qns = sequences.quantizeNoteSequence(prev_ns,stepsPerQuarter)
      postMessage({ns: prev_ns,qns, destination})
    }
    else{
      repeatingFor = 0
      interpolatingFor = 0
      process(ev.data).then( (ns) => {
        const qns = sequences.quantizeNoteSequence(ns,stepsPerQuarter)
        postMessage({ns,qns, destination})
        prev_ns = ns
      })
    }



  } catch (err) {
    console.error(err);
  }
})



async function process(data) {

  const {qpm,temperature,strategy, notes, timeOffset, destination,interpolateFor} = data
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
      tap_or_continue(ns,temperature, stepsPerQuarter, qpm)
    case 'interpolate':
      return await interpolate(ns,temperature, stepsPerQuarter, qpm, interpolateFor)

    default:
      break;
  }
}



async function tap2Drum(ns,temperature, stepsPerQuarter, qpm) {
  const ts = tapVae.dataConverter.toTensor(ns)
  // collapse into a hi hat
  const input = await tapVae.dataConverter.toNoteSequence(ts)
  const z = await tapVae.encode([input])
  const decoded = await tapVae.decode(z,temperature, null, stepsPerQuarter, qpm)
  return decoded[0]
}



async function tap_or_continue(ns,temperature, stepsPerQuarter, qpm) {

  if(!prev_ns)
    return await groove(ns,temperature, stepsPerQuarter, qpm)
  else{
    if(ns.notes.length===0)
      return await continueGroove(prev_ns,temperature, stepsPerQuarter, qpm)
    else{
      // get tap2drum
      const tap = await tap2Drum(ns,temperature, stepsPerQuarter, qpm)
      // get interpolation from prev_ns and tapped
      const int = await grooVae.interpolate([prev_ns,tap], 3)
      //return middle point
      return int[1]
    }
  }

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




async function interpolate(ns,temperature, stepsPerQuarter, qpm, interpolateFor) {
  const samples = await grooVae.sample(2, temperature, null, stepsPerQuarter, qpm)
  if(interp)
    interp = await grooVae.interpolate([interp[interpolateFor-1],samples[0]], interpolateFor)
  else
    interp = await grooVae.interpolate(samples, interpolateFor)

  // no way to set qpm through interpolate... so stretch manually
  for ( let i= 0; i< interp.length; i++){
    interp[i].tempos[0].qpm = qpm
    for ( let j= 0; j< interp[i].notes.length; j++){
      interp[i].notes[j].startTime *= (120/qpm)
      interp[i].notes[j].endTime *= (120/qpm)
    }
  }

  return interp[0]
}
