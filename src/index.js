import './index.css'
import * as serviceWorker from './serviceWorker';
import {MIDIPlayer} from "@magenta/music/node/core"
import Tone from 'tone'
import gWorker from './generate.worker.js'
import MidiIO from "./MidiIO"
import Recorder from "./Recorder"
import PianoRoll from "./PianoRoll"
import DrumKit from "./DrumKit"
import MonoBass from "./MonoBass"

const worker = new gWorker()
const recorder = new Recorder()
const midiPlayer = new MIDIPlayer()
const midiIO = new MidiIO()
const monoBass = new MonoBass()

//get dom elements references
const pianoRoll = new PianoRoll(document.getElementById('pianoRoll'))
const pianoRoll2 = new PianoRoll(document.getElementById('pianoRoll2'))
const progressMarker = document.getElementById('progress')
const seedMarker = document.getElementById('seed')
const generatingMarker = document.getElementById('generating')


//Tone.context.latencyHint = 'interactive'
Tone.context.latencyHint = 'fastest'

//initialize midi
midiIO.initialize().then(() => {
  midiIO.connectAllInputs()
  midiIO.onNoteOn(recorder.noteOn)
  midiIO.onNoteOff(recorder.noteOff)
  midiIO.onNoteOn(monoBass.noteOn)
  midiIO.onNoteOff(monoBass.noteOff)

  Tone.Transport.start()
})

let generatedNotes = []

//todo: get rid of this hardcoded 960px wide
const getWidth = (normalized) => Math.floor(960*normalized)


// a single function where to update visuals
const	updateVisuals = (transport) =>{
  pianoRoll.draw(recorder.notes)
  pianoRoll2.draw(generatedNotes)

  // gives a loop progress visual feedback
  progressMarker.style = `left:${getWidth(transport.progress)}px`
  // call this fuction again on next frame
  requestAnimationFrame(()=>updateVisuals(transport))
}
updateVisuals(Tone.Transport)


//repeated event every one measure
const measures = 8
const chunks = 8
let next_chunk = 0
//setup transport
Tone.Transport.bpm.value = 120
Tone.Transport.loop = true
Tone.Transport.loopEnd = Tone.Time(measures, 'm')



Tone.Transport.scheduleRepeat( (time) => {
  next_chunk++
  next_chunk %= chunks
  const prev_chunk = (next_chunk-2+chunks) % chunks

  // get time interval to filter recorder notes as seed
  const t1 = prev_chunk*Tone.Time(measures/chunks,'m')
  const t2 = (prev_chunk+1)*Tone.Time(measures/chunks,'m')

  //todo: trim endTime instead of strip
  const notes = recorder.notes.filter(
    n => n.endTime
         && (n.startTime < n.endTime)
         && (n.startTime >= t1 && n.startTime < t2 ))

  // send notes to worker
  worker.postMessage({notes, timeOffset: t1, destination: next_chunk})

  //instead of scheduling visuals inside of here
	//schedule a deferred callback with Tone.Draw
	Tone.Draw.schedule(() =>{
		//this callback is invoked from a requestAnimationFrame
		//and will be invoked close to AudioContext time
    const w = `width:${getWidth(1/chunks)}px`
    generatingMarker.style = `${w};left:${getWidth(next_chunk/chunks)}px`
    seedMarker.style = `${w};left:${getWidth((prev_chunk/chunks))}px`
	}, time) //use AudioContext time of the event

}, Tone.Time(measures/chunks, 'm'))


//limit recorder notes history
Tone.Transport.scheduleRepeat( (time) => {
  // 7 measures is the total history length allowed
  const t1 = Tone.Transport.seconds
  const t2 = (t1 < Tone.Time('7m')) ? t1 + Tone.Time('1m') : t1 - Tone.Time('7m')
  recorder.notes = recorder.notes.filter(
      n => (t1<t2) ? (n.startTime < t1 || n.startTime > t2 )
                   : (n.startTime < t1 && n.startTime > t2 ))
}, '2n')


Tone.Transport.scheduleRepeat( (time) => {
  DrumKit.play({pitch:60, velocity:5})
}, '1n')





const setTempo = (qpm) =>{
  if (Tone.Transport.state === 'started')
    Tone.Transport.bpm.value = qpm
}


const onWorkerResponse = (ev) => {
  const {ns, destination} = ev.data
  if(ns){
    // get time interval to replace generatedNotes
    const t1 = destination*Tone.Time(measures/chunks,'m')
    const t2 = (destination+1)*Tone.Time(measures/chunks,'m')

    // filter out old chunk
    generatedNotes = generatedNotes.filter(n => (n.startTime < t1 || n.startTime > t2 ))

    const data = ns.notes.map(n => {return {time: n.startTime, n}})


    //shift notes to destination chunk and add them
    ns.notes.forEach(n=>{
      n.startTime += t1
      n.endTime += t1
      generatedNotes.push(n)

      Tone.Transport.scheduleOnce((time) =>{
      	DrumKit.play(n)
        pianoRoll2.drawNote(n, true)
      }, n.startTime)

    })


  }
  //console.log(ev.data)
}

worker.addEventListener('message', onWorkerResponse)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
