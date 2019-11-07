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

const pianoRoll = new PianoRoll(document.getElementById('pianoRoll'))
const pianoRoll2 = new PianoRoll(document.getElementById('pianoRoll2'))

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
  noteOn: (note) =>{
    DrumKit.play(note)
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
