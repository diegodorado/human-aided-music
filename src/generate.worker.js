import {MusicVAE} from "@magenta/music/node/music_vae"
import {NoteSequence} from "@magenta/music/node/protobuf"
import {sequences} from "@magenta/music/node/core"
import {ns_strech} from "./ns_utils"

const CHECKPOINTS_DIR = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/'
const TAP2DRUM_CKPT = `${CHECKPOINTS_DIR}groovae_tap2drum_2bar`
const GROOVE2BAR_CKPT = `${CHECKPOINTS_DIR}groovae_2bar_humanize`

const tapVae = new MusicVAE(TAP2DRUM_CKPT)
const grooVae = new MusicVAE(GROOVE2BAR_CKPT)
const stepsPerQuarter = 4

// state
let initialized = false
let interp = null
let interpIdx = 0

// initialize all models
Promise.all([
    tapVae.initialize(),
    grooVae.initialize(),
  ]).then( () => initialized = true)

// receive a note sequence, and return another one
self.addEventListener('message', (ev)=>{
  if(!initialized )
    return postMessage({msg: 'Not ready yet'})

  try {
    const {destination} = ev.data
    process(ev.data).then( ([ns,msg]) => {
      //adds quantized fields to notes
      ns = sequences.quantizeNoteSequence(ns,stepsPerQuarter)
      postMessage({ns,msg, destination})
    })
  } catch (err) {
    console.error(err);
  }
})



async function process(data) {

  const {qpm,temperature,interpolation, notes, timeOffset, destination,reactiveness} = data

  // we first need an initial state!
  if(interp===null){
    // get 2 random samples
    const samples = await grooVae.sample(2, temperature, null, stepsPerQuarter, qpm)
    //fill interp array
    interp = await interpolate(samples, temperature, qpm, interpolation)
    //reset index
    interpIdx = 0
    //return the first pattern
    return [interp[0],'First random pattern']
  }

  // check if we have input from user
  if(notes.length>0){
    // we have input, so get a note sequence out of it
    const ns = await tapify(notes, timeOffset,temperature, qpm)

    if(reactiveness===1)
      return [ns,`fully listening, ${Math.round(reactiveness*100)}% reactiveness`]
    //arbitrary length
    const length = 20
    // interpolate from current pattern to tap pattern
    const seqs = await interpolate([interp[interpIdx],ns], temperature, qpm, length)
    // get idx based on reactiveness
    const seqIdx = Math.floor(reactiveness*(length-1))
    //return that pattern
    return [seqs[seqIdx],`listening with ${Math.round(reactiveness*100)}% reactiveness`]
  }
  else{
    // advance idx
    interpIdx++

    // if we are out of range, regenerate
    if(interpIdx >= interp.length){
      // get a random samples
      const samples = await grooVae.sample(1, temperature, null, stepsPerQuarter, qpm)
      //fill interp array
      interp = await interpolate([interp[interp.length-1],samples[0]], temperature, qpm, interpolation)
      //reset index
      interpIdx = 0
    }

    // just return current interpolation step
    return [interp[interpIdx],`generate - step ${interpIdx+1} of ${interpolation}`]

  }
}


async function tapify(notes,timeOffset,temperature, qpm) {
  // Shift the sequence back to time 0
  notes.forEach(n => {
     n.startTime -= timeOffset
     n.endTime -= timeOffset
  })

  try {
    const ns = NoteSequence.create({notes, tempos:[{qpm}]})
    //todo: handle this error
    //Error: Model does not support sequences with more than 32 steps (4 seconds at qpm 120).
    const ts = tapVae.dataConverter.toTensor(ns)
    // collapse into a hi hat
    const input = await tapVae.dataConverter.toNoteSequence(ts)
    const z = await tapVae.encode([input])
    const decoded = await tapVae.decode(z,temperature, null, stepsPerQuarter, qpm)
    return decoded[0]
  } catch (err) {
    console.error(err)
    debugger
  }

}

async function interpolate(samples, temperature, qpm, length) {
  //fill interp array
  const seqs = await grooVae.interpolate(samples, length)

  // no way to set qpm through interpolate... so stretch manually
  for ( let i= 0; i< seqs.length; i++){
    ns_strech(seqs[i],qpm)
  }
  return seqs
}
