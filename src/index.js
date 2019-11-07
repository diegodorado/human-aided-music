import './App.css'
import * as serviceWorker from './serviceWorker';
import {sequences,MIDIPlayer} from "@magenta/music/node/core"
import Tone from 'tone'
import gWorker from './generate.worker.js'
import MidiIO from "./MidiIO"
import Recorder from "./Recorder"
import PianoRoll from "./PianoRoll"
import DrumKit from "./DrumKit"

const worker = new gWorker()
const recorder = new Recorder()
const midiPlayer = new MIDIPlayer()
const midiIO = new MidiIO()



const el = document.getElementById('pianoRoll')
const pianoRoll = new PianoRoll(el)
const el2 = document.getElementById('pianoRoll2')
const pianoRoll2 = new PianoRoll(el2)

midiPlayer.requestMIDIAccess().then(() => {
})

midiIO.initialize().then(() => {
  recorder.start(midiIO.midiInputs)
})

recorder.callbackObject = {
  runQuarter: (seq, index) => {
    worker.postMessage(seq)
    console.log(seq)
  },
  update: (seq) => {
    pianoRoll.update(seq)
  },
  noteOn: (pitch) =>{
    const time = performance.now() / 1000
    const note = { pitch: pitch,velocity: 100,startTime: time,endTime: time+0.5,isDrum: true}
    DrumKit.play(pitch)
  }
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
