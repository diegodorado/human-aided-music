import './index.sass'
import * as serviceWorker from './serviceWorker'
import Tone from 'tone'
import gWorker from './generate.worker.js'
import MidiIO from "./MidiIO"
import Recorder from "./Recorder"
//import DrumKit from "./DrumKit"
import DrumKit from "./MockDrumKit"
//import MonoBass from "./MonoBass"
import MonoBass from "./MockMonoBass"
import {setupGUI,onMidiDevicesChanged} from './GUI'
import StartAudioContext from 'startaudiocontext'
import { setupOrca,updateOrcaVis, updateOrcaDrums,updateOrcaMarkers, updateOrcaNote} from './Orca'
import { setClickVolume, changeClickActive} from './Click'
import {setupKeyboard} from './Keyboard'
import {setupStats,beginMs, endMs } from './Stats'
import {ns_strech} from "./ns_utils"


const stats = document.getElementById('stats')
setupStats(stats)

/*APP OPTIONS*/
const options = {
  qpm: 120,
  input: 'keyboard',
  output: 'webaudio',
  useSynth: true,
  playClick: false,
  clickVolume: -12,
  quantize: false,
  drumsVolume: 0,
  synthVolume: -24,
  temperature: 1.0,
  subdivisions: 8,
  measures: 8,
  steps: 8*16,
  interpolation: 1,
  reactiveness: 0.5
}

let generatedNotes = []

const worker = new gWorker()
const recorder = new Recorder()
const midiIO = new MidiIO()
const monoBass = new MonoBass()

//get dom elements references
const guiEl = document.getElementById('gui')
const startButton = document.getElementById('start')
const orca = document.getElementById('orca')
const msgEl = document.getElementById('msg')

setupOrca(orca, recorder, options)

// handlers from both midi and keyboard
const noteOn = (note) =>{
  // gets a quantized note
  note = recorder.noteOn(note)
  updateOrcaNote(note)
  monoBass.noteOn(note)
}
const noteOff = (note) =>{
  recorder.noteOff(note)
  monoBass.noteOff(note)
}

setupKeyboard(options,noteOn,noteOff)

const setTempo = (qpm) =>{
  if (Tone.Transport.state === 'started'){
    Tone.Transport.bpm.value = qpm
    options.qpm = qpm
  }
}


setupGUI(guiEl, options, monoBass,DrumKit, changeClickActive, setClickVolume, setTempo)



const getTimeInterval = (chunk) => {
  const frag = Tone.Transport.loopEnd/options.subdivisions
  return [chunk*frag, (chunk+1)*frag]
}


const updateDrums = (time) => {
  // which chunk
  const next_chunk = (tick/options.steps*options.subdivisions + 1) % options.subdivisions
  const prev_chunk = (next_chunk-2+options.subdivisions) % options.subdivisions

  // get time interval to filter recorder notes as seed
  const [t1,t2] = getTimeInterval(prev_chunk)

  //todo: trim endTime instead of strip
  //todo: quantize, so you do not miss first beat
  const notes = recorder.notes.filter(
    n => n.endTime
         && (n.startTime < n.endTime)
         && (n.startTime >= t1 && n.startTime < t2 ))

  // filter out old chunk
  const [tt1,tt2] = getTimeInterval(next_chunk)
  generatedNotes = generatedNotes.filter(n => (n.startTime < tt1 || n.startTime > tt2 ))
  recorder.notes = recorder.notes.filter(n => (n.startTime < tt1 || n.startTime > tt2 ))

  // send notes to worker
  worker.postMessage({
      qpm: options.qpm,
      temperature: options.temperature,
      reactiveness: options.reactiveness,
      interpolation: options.interpolation,
      notes,
      timeOffset: t1,
      destination: next_chunk
    })

  beginMs() // begin measure worker time

	Tone.Draw.schedule(() =>{
    updateOrcaMarkers(options.subdivisions, prev_chunk, next_chunk)
	}, time) //use AudioContext time of the event


}



let tick = 0
//a single schedule!
Tone.Transport.scheduleRepeat( (time) => {
	Tone.Draw.schedule(() =>updateOrcaVis(tick), time)
  if((tick%(options.steps/options.subdivisions))===0){
    updateDrums(time)
  }
  tick++
  tick %= options.steps
}, '16n')



startButton.textContent='START'
startButton.disabled=false
StartAudioContext(Tone.context, '#start').then(() =>{
	document.body.className = ''
  //setup transport
  Tone.Transport.bpm.value = options.qpm
  Tone.Transport.loop = true
  Tone.Transport.loopEnd = Tone.Time(options.measures, 'm')
  // Tone.context.latencyHint = 'interactive'
  // Tone.context.latencyHint = 'playback'
  // Tone.context.latencyHint = 'fastest'
  // console.log('Tone.context.lookAhead',Tone.context.lookAhead)
  Tone.Transport.start()
})



let lastMidiClockAt = 0
let midiClockCounter = 0

//initialize midi
midiIO.initialize({autoconnectInputs:true}).then(() => {
  midiIO.onNoteOn((data) => {
    if (options.input === data.device.id || options.input === 'all'){
      noteOn(data)
    }
  })
  midiIO.onNoteOff((data) => {
    if (options.input === data.device.id || options.input === 'all'){
      noteOff(data)
    }
  })

  midiIO.onClock((ev) => {
    if (options.input === ev.target.id || options.input === 'all'){
      if (midiClockCounter % 6 === 0) {
        const diff = ev.timeStamp - lastMidiClockAt
        const bpm = Math.round(60/diff/4*1000)
        // dont trigger tempo change by noise
        if(Math.abs(Tone.Transport.bpm.value-bpm)>2)
          setTempo(bpm)
        lastMidiClockAt = ev.timeStamp
      }
      midiClockCounter++
    }
  })

  midiIO.onStart((ev) => {
    return //disabled for now
    Tone.Transport.start()
  })

  midiIO.onStop((ev) => {
    return //disabled for now
    Tone.Transport.stop()
  })

  midiIO.onDevicesChanged(onMidiDevicesChanged)

})




const playDrum = (note,time) =>{
  if(options.output==='none'){
    return
  }else if(options.output==='webaudio'){
    DrumKit.play(note, time)
  }else{
    const device = midiIO.getOutputById(options.output)
    const length = (note.endTime - note.startTime) * 1000 // in ms.
    // ensure defaults
    note.velocity |= 100
    // send note on and delayed note off
    device.send([0x90, note.pitch,note.velocity])
    device.send([0x80, note.pitch,0]
      ,window.performance.now() + length)
  }
}





const onWorkerResponse = (ev) => {
  const {ns, destination,msg} = ev.data
  msgEl.textContent = msg


  if(ns){
    endMs() // end measure worker time

    if(ns.tempos[0].qpm !== options.qpm){
      //strech ns if tempo has changed
      ns_strech(ns,options.qpm)
    }

    const [t1,t2] = getTimeInterval(destination)
    // worker may return a longer sequence, so filter out
    ns.notes = ns.notes.filter(n => n.quantizedStartStep < (options.steps/options.subdivisions))
    updateOrcaDrums(ns, destination, options.subdivisions)

    // shift notes to destination chunk and add them
    const stepTime = Tone.Time('16n')
    for(let i = 0;i<ns.notes.length;i++){
      const n = ns.notes[i]
      if(options.quantize){
        n.startTime = t1 + n.quantizedStartStep * stepTime
        n.endTime = t1 + n.quantizedEndStep * stepTime
      }else{
        n.startTime += t1
        n.endTime += t1
      }
      generatedNotes.push(n)
      Tone.Transport.scheduleOnce((time) =>{
      	playDrum(n,time)
      }, n.startTime)
    }
  }
}

worker.addEventListener('message', onWorkerResponse)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
