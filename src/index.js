import './index.css'
import * as serviceWorker from './serviceWorker';
import {NoteSequence} from "@magenta/music/node/protobuf"
import {sequences,MIDIPlayer} from "@magenta/music/node/core"
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
const progress = document.getElementById('progress')

//setup transport
Tone.Transport.bpm.value = 120
Tone.Transport.loop = true
Tone.Transport.loopEnd = '8m'
//Tone.context.latencyHint = 'interactive'
Tone.context.latencyHint = 'fastest'

const playDrum = (note) =>{
  //DrumKit.play(note)
  const a = Tone.Frequency(note.pitch, "midi").toNote()
}

//initialize midi
midiIO.initialize().then(() => {
  midiIO.connectAllInputs()
  midiIO.onNoteOn(recorder.noteOn)
  midiIO.onNoteOff(recorder.noteOff)
  //midiIO.onNoteOn(playDrum)
  midiIO.onNoteOn(monoBass.noteOn)
  midiIO.onNoteOff(monoBass.noteOff)

  Tone.Transport.start()
})


//limit recorder notes history
new Tone.Loop((time) => {
  // 7 measures is the total history length allowed
  const t1 = Tone.Transport.seconds
  const t2 = (t1 < Tone.Time('7m')) ? t1 + Tone.Time('1m') : t1 - Tone.Time('7m')
  recorder.notes = recorder.notes.filter(
      n => (t1<t2) ? (n.startTime < t1 || n.startTime > t2 )
                   : (n.startTime < t1 && n.startTime > t2 ))
}, '2n').start()

// a single function where to update visuals
const	updateVisuals = (transport) =>{
  pianoRoll.draw(recorder.notes)
  // gives a loop progress visual feedback
  //todo: get rid of this hardcoded 960px wide
  progress.style = `left:${Math.floor(960*transport.progress)}px`
  // call this fuction again on next frame
  requestAnimationFrame(()=>updateVisuals(transport))
}
updateVisuals(Tone.Transport)







new Tone.Loop((time) => {
  const quarterTimeSpan = Tone.Time('2m')
  const notes = recorder.notes.filter(
      n => (n.endTime && time - n.startTime < quarterTimeSpan))
  //deep clone
  const _notes = Array.from(notes, n=> Object.assign({}, n))
  // Shift the sequence back to time 0
  _notes.forEach(n => {
      n.startTime -= (time-quarterTimeSpan)
      n.endTime -= (time-quarterTimeSpan)
  })

  const ns = NoteSequence.create({notes: _notes})
  const qns = sequences.quantizeNoteSequence(ns,4)
  //this.callbackObject.runQuarter(qns,quarter)
}, '2m')



recorder.callbackObject = {
  runQuarter: (seq, index) => {
    worker.postMessage(seq)
    console.log(seq)
  }
}


const setTempo = (qpm) =>{
  if (Tone.Transport.state === 'started')
    Tone.Transport.bpm.value = qpm
}

worker.addEventListener('message', (ev) => {
  if(ev.data){
    const seq = ev.data[0]
    pianoRoll2.update(seq)
  }
})

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();


new Tone.Loop((time) => {
  //instead of scheduling visuals inside of here
	//schedule a deferred callback with Tone.Draw
	Tone.Draw.schedule(function(){
		//this callback is invoked from a requestAnimationFrame
		//and will be invoked close to AudioContext time

	}, time) //use AudioContext time of the event
}, '8n') //.start()


//how to create a scheduled part of drums
const part = new Tone.Part(function(time, value){
	//the value is an object which contains both the note and the velocity
	console.log(time, value)
}, [{"time" : 0, "note" : "C3", "velocity": 0.9},
	   {"time" : "0:2", "note" : "C4", "velocity": 0.5}
   ]).start(0)
