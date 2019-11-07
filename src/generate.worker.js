import {MusicVAE} from "@magenta/music/node/music_vae"
import {NoteSequence} from "@magenta/music/node/protobuf"
import {sequences} from "@magenta/music/node/core"

const CHECKPOINTS_DIR = 'https://storage.googleapis.com/magentadata/js/checkpoints'
const TAP2DRUM_CKPT = `${CHECKPOINTS_DIR}/music_vae/groovae_tap2drum_2bar`;

const mvae = new MusicVAE(TAP2DRUM_CKPT)

let initialized = false

mvae.initialize().then( () => initialized = true)

// receive a note sequence, and return another one
self.addEventListener('message', (ev)=>{
  if(!initialized )
    return postMessage({msg: 'Not ready yet'})


  try {
    const {notes, timeOffset, destination} = ev.data
    // Shift the sequence back to time 0
    notes.forEach(n => {
       n.startTime -= timeOffset
       n.endTime -= timeOffset
    })

    const ns = NoteSequence.create({notes})
    const qns = sequences.quantizeNoteSequence(ns,4)
    postMessage({ns: qns, destination})

    //runTap2Drum(ev.data).then((data) => {
    //  postMessage(data)
    //})
  } catch (err) {
    console.error(err);
  }
})

async function runTap2Drum(seq) {


  // "Tapify" the inputs, collapsing them to hi-hat.
  let start = performance.now()
  const input = await mvae.dataConverter.toNoteSequence(mvae.dataConverter.toTensor(seq))
  console.log('tap2drum-inputs', input, true)
  console.log('tap2drum-convert-time', start)

  start = performance.now()
  const z = await mvae.encode([input])
  const recon = await mvae.decode(z)
  z.dispose()
  console.log('tap2drum-recon-time', start)
  console.log('tap2drum-recon', recon, true, true)

  start = performance.now()
  const sample = await mvae.sample(3)
  console.log('tap2drum-sample-time', start)
  console.log('tap2drum-samples', sample, true, true)
  //mvae.dispose()
  return recon
}
