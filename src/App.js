import React, {useState, useEffect, useRef} from 'react'
import './App.css'
import DRUM_SEQS from './drumSeq'
import {Recorder, Player, PianoRollCanvasVisualizer} from "@magenta/music/node/core"
import Tone from 'tone'

import gWorker from './generate.worker.js'

const synth = new Tone.Synth().toMaster()
const worker = new gWorker()


const App = () => {
  //this ref is set once
  const visualizerRef = useRef()
  const visualizer2Ref = useRef()

  const canvasRef = useRef()
  const canvas2Ref = useRef()

  //these refs are set only once
  const playerRef = useRef(new Player(false, {
    run: (note) => {
      visualizer2Ref.current.redraw(note, true)
    },
    stop: () => {
      console.log(playerRef.current.desiredQPM)
      if(loopRef.current)
        playerRef.current.start(visualizer2Ref.current.noteSequence)
    }
  }))
  const recoderRef = useRef()
  const loopRef = useRef(true)
  const [tempo, setTempo] = useState(120)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [playClick, setPlayClick] = useState(false)

  useEffect(()=>{
    worker.addEventListener('message', (ev) => {
      const seq = ev.data[0]
      visualizer2Ref.current = new PianoRollCanvasVisualizer(seq, canvas2Ref.current)
      playerRef.current.stop()
      playerRef.current.start(visualizer2Ref.current.noteSequence)
    })
  },[])

  if(!recoderRef.current){
    recoderRef.current = new Recorder()
    recoderRef.current.initialize().then(() => {
      setReady(true)
    })

    recoderRef.current.callbackObject = {
      run: (seq) => {
        if (seq)
          visualizerRef.current = new PianoRollCanvasVisualizer(seq, canvasRef.current)
      },
      noteOn: (pitch, velocity, device) => {
        synth.triggerAttack(Tone.Frequency(pitch, "midi").toNote())
      },
      noteOff: (pitch, velocity, device) => {
        synth.triggerRelease()
      }
    }

  }

  const onRecordClick = (ev) => {
    recoderRef.current.start()
    setRecording(true)
  }

  const onPlayClick = (ev) => {
    playerRef.current.start(visualizer2Ref.current.noteSequence)
  }

  const onStopClick = (ev) => {
    setRecording(false)
    const seq = recoderRef.current.stop()
    if (seq) {
      console.log(seq)
      worker.postMessage(seq)
    }
  }

  const onTempoChange = (ev) => {
    const t = parseFloat(ev.target.value)
    setTempo(t)
    recoderRef.current.setTempo(t)
    playerRef.current.setTempo(t)
  }


  const onPlayClickChange = (ev) => {
    const c = ev.target.checked
    setPlayClick(c)
    recoderRef.current.enablePlayClick(c)
  }

  return (
    <div className="App">
      <h1>Musica Asistida por Humano</h1>
      <h2>Basic usage</h2>
      <p> Once you create an <code>mm.Recorder</code>, it will connect to any MIDI inputs
        visible.
      </p>
      <section>
        <button onClick={onPlayClick} disabled={playerRef.current.isPlaying()}>{playerRef.current.isPlaying()?'...':'Play'}</button>
        <button onClick={onRecordClick} disabled={recording || !ready}>{recording?'...':'Record'}</button>
        <button onClick={onStopClick} disabled={!recording}>Stop</button>
        <label><b>Play click</b> <input type="checkbox" value={playClick} onChange={onPlayClickChange} /></label>
        <label><b>loop</b> <input type="checkbox" value={loopRef.current} onChange={ev => loopRef.current = ev.target.checked} /></label>
        <b>Tempo:</b>
        <input type="range" min="20" max="240" value={tempo} step="1" onChange={onTempoChange} />
        <output>{tempo}</output>
      </section>
      <section>
        <div className="visualizer-container">
          <canvas ref={canvasRef}></canvas>
        </div>
      </section>
      <section>
        <div className="visualizer-container">
          <canvas ref={canvas2Ref}></canvas>
        </div>
      </section>

    </div>
  )
}

export default App
