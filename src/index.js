import './index.css'
import * as serviceWorker from './serviceWorker';
import {SoundFontPlayer,MIDIPlayer} from "@magenta/music/node/core"
import Tone from 'tone'
import gWorker from './generate.worker.js'
import MidiIO from "./MidiIO"
import Recorder from "./Recorder"
import PianoRoll from "./PianoRoll"
import DrumKit from "./DrumKit2"
import MonoBass from "./MonoBass"
import {GUI} from 'dat.gui'


/*APP OPTIONS*/
const options = {
  tempo: 120,
  input: 'keyboard',
  output: 'webaudio',
  useSynth: true,
  playClick: false,
  temperature: 1.0
}


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


/*GUI STUFF*/
const gui = new GUI()
gui.add(options, 'tempo', 60, 180).name('Tempo')
gui.add(options, 'useSynth').name('Use Synth').onChange(monoBass.setActive)
gui.add(options, 'playClick').name('Play Click')
let input = gui.add(options, 'input',[])
let output = gui.add(options, 'output',[])
gui.add(options, 'temperature', 0.0, 2.0)

/*midi devices changed handler*/
const onDevicesChanged = (m) =>{
  const inputs = { 'Computer Keyboard': 'keyboard'}
  m.midiInputs.forEach(i => inputs[i.name] = i.id)
  input = input.options(inputs)

  const outputs = { 'WebAudio Drum': 'webaudio'}
  m.midiOutputs.forEach(i => outputs[i.name] = i.id)
  output = output.options(outputs)
}





//Tone.context.latencyHint = 'interactive'
Tone.context.latencyHint = 'fastest'

//initialize midi
midiIO.initialize({autoconnectInputs:true}).then(() => {
  midiIO.onNoteOn(recorder.noteOn)
  midiIO.onNoteOff(recorder.noteOff)
  midiIO.onNoteOn(monoBass.noteOn)
  midiIO.onNoteOff(monoBass.noteOff)
  midiIO.onDevicesChanged(onDevicesChanged)

  Tone.Transport.start()
})

const playDrum = (note,time) =>{
  if(options.output==='webaudio'){
    DrumKit.play(note)
  }else{

  }

}


const click = new Tone.MembraneSynth(
      {pitchDecay: 0.008,envelope: {attack: 0.001, decay: 0.3, sustain: 0}}
    ).toMaster()


const playClick = (step) =>{
  if(options.playClick){
    click.triggerAttack((step===0) ? 'C6' : 'G5')
  }
}



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
const chunks = 4
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


let beatStep = 0
Tone.Transport.scheduleRepeat( (time) => {
  playClick(beatStep)
  beatStep++
  beatStep%=4
}, '4n')





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



    ns.notes.filter(n => n.startTime < (t2-t1)).forEach(n=>{
      n.startTime += t1
      n.endTime += t1
      generatedNotes.push(n)

      Tone.Transport.scheduleOnce((time) =>{
      	playDrum(n,time)
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
