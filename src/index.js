import './index.sass'
import * as serviceWorker from './serviceWorker'
import Tone from 'tone'
import gWorker from './generate.worker.js'
import MidiIO from "./MidiIO"
import Recorder from "./Recorder"
import DrumKit from "./DrumKit"
import MonoBass from "./MonoBass"
import {setupGUI,onMidiDevicesChanged} from './GUI'
import AudioKeys from 'audiokeys'
import StartAudioContext from 'startaudiocontext'
import { setupOrca,updateOrcaVis, updateOrcaDrums,updateOrcaMarkers} from './Orca'
import { setClickVolume, changeClickActive} from './Click'
import {setupKeyboard} from './Keyboard'

/*APP OPTIONS*/
const options = {
  strategy: 'generate',
  qpm: 120,
  input: 'keyboard',
  output: 'webaudio',
  useSynth: true,
  playClick: false,
  clickVolume: -12,
  drumsVolume: 0,
  synthVolume: -24,
  temperature: 1.0
}

let generatedNotes = []

const worker = new gWorker()
const recorder = new Recorder()
const midiIO = new MidiIO()
const monoBass = new MonoBass()
monoBass.setVolume(options.synthVolume)

//get dom elements references
const guiEl = document.getElementById('gui')
const startButton = document.getElementById('start')
const orcaVis = document.getElementById('orca')

setupOrca(orcaVis)
setupKeyboard(options,recorder,monoBass)

const setTempo = (qpm) =>{
  if (Tone.Transport.state === 'started'){
    Tone.Transport.bpm.value = qpm
  }
}

setupGUI(guiEl, options, monoBass,DrumKit, changeClickActive, setClickVolume, setTempo)


Tone.Transport.scheduleRepeat( (time) => {
	Tone.Draw.schedule(() =>{
		updateOrcaVis(recorder)
	}, time)
}, Tone.Time('16n'))


startButton.textContent='START'
startButton.disabled=false
StartAudioContext(Tone.context, '#start').then(() =>{
	document.body.className = ''
})






let lastMidiClockAt = 0
let midiClockCounter = 0

//Tone.context.latencyHint = 'interactive'
Tone.context.latencyHint = 'fastest'
//initialize midi
midiIO.initialize({autoconnectInputs:true}).then(() => {
  midiIO.onNoteOn((data) => {
    if (options.input === data.device.id || options.input === 'all'){
      recorder.noteOn(data)
      monoBass.noteOn(data)
    }
  })
  midiIO.onNoteOff((data) => {
    if (options.input === data.device.id || options.input === 'all'){
      recorder.noteOff(data)
      monoBass.noteOff(data)
    }
  })

  midiIO.onClock((ev) => {
    return //disabled for now
    if (midiClockCounter % 6 === 0) {
      const diff = ev.timeStamp - lastMidiClockAt
      const bpm = Math.round(60/diff/4*1000)
      if(Tone.Transport.bpm.value !== bpm)
        setTempo(bpm)
      lastMidiClockAt = ev.timeStamp
    }
    midiClockCounter++;
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

  Tone.Transport.start()
})


const playDrum = (note,time) =>{
  if(options.output==='none'){
    return
  }else if(options.output==='webaudio'){
    DrumKit.play(note)
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


//repeated event every one measure
const measures = 8
const chunks = 4
let next_chunk = 0
//setup transport
Tone.Transport.bpm.value = options.qpm
Tone.Transport.loop = true
Tone.Transport.loopEnd = Tone.Time(measures, 'm')

Tone.Transport.scheduleRepeat( (time) => {
  next_chunk++
  next_chunk %= chunks

  // which chunk
  const chunk = (next_chunk-2+chunks) % chunks

  // get time interval to filter recorder notes as seed
  const loopEnd = Tone.Transport.loopEnd
  const t1 = chunk*(loopEnd/chunks)
  const t2 = (chunk+1)*(loopEnd/chunks)

  //todo: trim endTime instead of strip
  //todo: quantize, so you do not miss first beat
  const notes = recorder.notes.filter(
    n => n.endTime
         && (n.startTime < n.endTime)
         && (n.startTime >= t1 && n.startTime < t2 ))


  // filter out old chunk
  const tt1 = next_chunk*(loopEnd/chunks)
  const tt2 = (next_chunk+1)*(loopEnd/chunks)
  generatedNotes = generatedNotes.filter(n => (n.startTime < tt1 || n.startTime > tt2 ))


  // send notes to worker
  worker.postMessage({
      qpm: options.qpm,
      temperature: options.temperature,
      strategy: options.strategy,
      notes,
      timeOffset: t1,
      destination: next_chunk
    })

	Tone.Draw.schedule(() =>{
    updateOrcaMarkers(recorder, chunks, chunk, next_chunk)
	}, time) //use AudioContext time of the event

}, Tone.Time(measures/chunks, 'm'))


//limit recorder notes history
Tone.Transport.scheduleRepeat( (time) => {
  const loopEnd = Tone.Transport.loopEnd

  // 7 measures is the total history length allowed
  const p1 = Tone.Transport.seconds/loopEnd
  const p2 = (p1 < Tone.Time('7m')/loopEnd)
    ? p1 + Tone.Time('1m')/loopEnd
    : p1 - Tone.Time('7m')/loopEnd
  recorder.notes = recorder.notes.filter(
      n => (p1<p2) ? (n.position < p1 || n.position > p2 )
                   : (n.position < p1 && n.position > p2 ))
}, '2n')




const onWorkerResponse = (ev) => {
  const {ns, qns,destination} = ev.data
  if(ns){
    // get time interval to replace generatedNotes
    const loopEnd = Tone.Transport.loopEnd
    const t1 = destination*(loopEnd/chunks)
    const t2 = (destination+1)*(loopEnd/chunks)

    updateOrcaDrums(qns, destination, chunks)

    //shift notes to destination chunk and add them
    // todo: quantize?
    //ns.notes.filter(n => n.startTime>0 && n.startTime < (t2-t1)).forEach(n=>{
    ns.notes.forEach(n=>{
      n.startTime += t1
      n.endTime += t1

      // position and duration is for normalized rendering purposes
      n.position = n.startTime/loopEnd
      n.duration = (n.endTime-n.startTime)/loopEnd

      generatedNotes.push(n)

      Tone.Transport.scheduleOnce((time) =>{
      	playDrum(n,time)
      }, n.startTime)

    })


  }
}

worker.addEventListener('message', onWorkerResponse)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
