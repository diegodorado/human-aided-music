import React, {useState, useEffect, useRef} from 'react'
import './Codepen.css'
import _ from 'lodash'
import {sequences} from "@magenta/music/node/core"
import Tone from 'tone'
import rgWorker from './regenerate.worker.js'

const worker = new rgWorker()

//hacky workaround not having WebMidi as an es6 module
let WebMidi = window.WebMidi

const DRUM_CLASSES = [
  'Kick',
  'Snare',
  'Hi-hat closed',
  'Hi-hat open',
  'Tom low',
  'Tom mid',
  'Tom high',
  'Clap',
  'Rim'
]
const TIME_HUMANIZATION = 0.01;
const sampleBaseUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699'

const reverb = new Tone.Convolver(
  `${sampleBaseUrl}/small-drum-room.wav`
).toMaster()
reverb.wet.value = 0.35
const snarePanner = new Tone.Panner().connect(reverb)
new Tone.LFO(0.13, -0.25, 0.25).connect(snarePanner.pan).start()

let drumKit = [
  new Tone.Players({
    high: `${sampleBaseUrl}/808-kick-vh.mp3`,
    med: `${sampleBaseUrl}/808-kick-vm.mp3`,
    low: `${sampleBaseUrl}/808-kick-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${sampleBaseUrl}/flares-snare-vh.mp3`,
    med: `${sampleBaseUrl}/flares-snare-vm.mp3`,
    low: `${sampleBaseUrl}/flares-snare-vl.mp3`
  }).connect(snarePanner),
  new Tone.Players({
    high: `${sampleBaseUrl}/808-hihat-vh.mp3`,
    med: `${sampleBaseUrl}/808-hihat-vm.mp3`,
    low: `${sampleBaseUrl}/808-hihat-vl.mp3`
  }).connect(new Tone.Panner(-0.5).connect(reverb)),
  new Tone.Players({
    high: `${sampleBaseUrl}/808-hihat-open-vh.mp3`,
    med: `${sampleBaseUrl}/808-hihat-open-vm.mp3`,
    low: `${sampleBaseUrl}/808-hihat-open-vl.mp3`
  }).connect(new Tone.Panner(-0.5).connect(reverb)),
  new Tone.Players({
    high: `${sampleBaseUrl}/slamdam-tom-low-vh.mp3`,
    med: `${sampleBaseUrl}/slamdam-tom-low-vm.mp3`,
    low: `${sampleBaseUrl}/slamdam-tom-low-vl.mp3`
  }).connect(new Tone.Panner(-0.4).connect(reverb)),
  new Tone.Players({
    high: `${sampleBaseUrl}/slamdam-tom-mid-vh.mp3`,
    med: `${sampleBaseUrl}/slamdam-tom-mid-vm.mp3`,
    low: `${sampleBaseUrl}/slamdam-tom-mid-vl.mp3`
  }).connect(reverb),
  new Tone.Players({
    high: `${sampleBaseUrl}/slamdam-tom-high-vh.mp3`,
    med: `${sampleBaseUrl}/slamdam-tom-high-vm.mp3`,
    low: `${sampleBaseUrl}/slamdam-tom-high-vl.mp3`
  }).connect(new Tone.Panner(0.4).connect(reverb)),
  new Tone.Players({
    high: `${sampleBaseUrl}/909-clap-vh.mp3`,
    med: `${sampleBaseUrl}/909-clap-vm.mp3`,
    low: `${sampleBaseUrl}/909-clap-vl.mp3`
  }).connect(new Tone.Panner(0.5).connect(reverb)),
  new Tone.Players({
    high: `${sampleBaseUrl}/909-rim-vh.wav`,
    med: `${sampleBaseUrl}/909-rim-vm.wav`,
    low: `${sampleBaseUrl}/909-rim-vl.wav`
  }).connect(new Tone.Panner(0.5).connect(reverb))
];
let midiDrums = [36, 38, 42, 46, 41, 43, 45, 49, 51];

const outputs = {
  internal: {
    play: (drumIdx, velocity, time) => {
      drumKit[drumIdx].get(velocity).start(time);
    }
  }
}

const getStepVelocity = (step) =>{
  if (step % 4 === 0)
    return 'high'
  else if (step % 2 === 0)
    return 'med'
  else
    return 'low'
}

function humanizeTime(time) {
  return time + (Math.random()-0.5) * TIME_HUMANIZATION;
}

Promise.all([
  new Promise(res => Tone.Buffer.on('load', res))
]).then(([vars]) => {

});


let hasBeenStarted = false,
currentSchedulerId,
stepCounter;

const Codepen = () => {

  let oneEighth = Tone.Time('8n').toSeconds(),
    activeOutput = 'internal',
    midiClockSender = null,
    midiClockStartSent = false,
    activeClockInput = 'none'

  const [tempo, setTempo] = useState(120)
  const [pattern, setPattern] = useState([[0], [1], [2]].concat(_.times(29, i => [])))
  const [patternLength, setPatternLength] = useState(32)
  const [seedLength, setSeedLength] = useState(4)
  const [swing, setSwing] = useState(0.55)
  const [temperature, setTemperature] = useState(1.0)
  const [playing, setPlaying] = useState(false)

  const patternRef = useRef(pattern)
  patternRef.current = pattern
  const swingRef = useRef(swing)
  swingRef.current = swing


  const onPatternLengthChange = (ev) => {
    const l = parseFloat(ev.target.value)
    setPatternLength(l)
  }

  const onSeedLengthChange = (ev) => {
    const l = parseFloat(ev.target.value)
    setSeedLength(l)
  }

  const onTempoChange = (ev) => {
    const t = parseFloat(ev.target.value)
    setTempo(t)
    Tone.Transport.bpm.value = t
    oneEighth = Tone.Time('8n').toSeconds()

  }

  const onSwingChange = (ev) => {
    const s = parseFloat(ev.target.value)
    setSwing(s)
  }

  const onTemperatureChange = (ev) => {
    const t = parseFloat(ev.target.value)
    setTemperature(t)
  }

  function startPattern() {
    stepCounter = -1;
    midiClockStartSent = false;
  }

  function stopPattern() {
    stepCounter = null;
  }


  let regenerating = false

  // todo: use css3
  const visualizePlay = (time, stepIdx, drumIdx) =>{
    Tone.Draw.schedule(() => {
      const sel = `.step:nth-child(${stepIdx+1}) .cell.on:nth-child(${drumIdx+1})`
      let animTime = oneEighth * 4 * 1000;
      const el = document.querySelector(sel)
      if(el){
        el.animate(
          [
            {transform: 'translateZ(-100px)',filter: 'grayscale(1)'},
            {transform: 'translateZ(50px)',offset: 0.7},
            { transform: 'translateZ(0)', filter: 'grayscale(0)'}
          ],
          { duration: animTime, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
        )
      }
    }, time);
  }

  const tick = (time = Tone.now() - Tone.context.lookAhead) =>{
    if (_.isNumber(stepCounter)) {
      stepCounter++

      if (midiClockSender) midiClockSender(time, stepCounter)

      let stepIdx = stepCounter % patternRef.current.length
      let isSwung = stepIdx % 2 !== 0
      if (isSwung) {
        time += (swingRef.current - 0.5) * oneEighth
      }
      let velocity = getStepVelocity(stepIdx)
      let drums = patternRef.current[stepIdx]

      drums.forEach(d => {
        let humanizedTime = stepIdx === 0 ? time : humanizeTime(time)
        outputs[activeOutput].play(d, velocity, humanizedTime)
        visualizePlay(humanizedTime, stepIdx, d)
      })
    }
  }


  useEffect(()=>{
    worker.addEventListener('message', (ev) => {
      setPattern(ev.data)
    })
  },[])

  useEffect(()=>{



    WebMidi.enable(err => {
      if (err) {
        console.error('WebMidi could not be enabled', err);
        return;
      }
      let outputSelector = document.querySelector('.midi-output');
      let clockOutputSelector = document.querySelector('.midi-clock-output');
      let clockInputSelector = document.querySelector('.midi-clock-input');
      let activeClockOutput,
        midiClockCounter = 0,
        eighthsCounter = 0,
        lastEighthAt;

      function onDevicesChanged() {
        while (outputSelector.firstChild) {
          outputSelector.firstChild.remove();
        }
        let internalOption = document.createElement('option');
        internalOption.value = 'internal';
        internalOption.innerText = 'Internal drumkit';
        outputSelector.appendChild(internalOption);
        for (let output of WebMidi.outputs) {
          let option = document.createElement('option');
          option.value = output.id;
          option.innerText = output.name;
          outputSelector.appendChild(option);
        }
        //$(outputSelector).formSelect();
        onActiveOutputChange('internal');

        while (clockOutputSelector.firstChild) {
          clockOutputSelector.firstChild.remove();
        }
        let noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.innerText = 'Not sending';
        clockOutputSelector.appendChild(noneOption);
        for (let output of WebMidi.outputs) {
          let option = document.createElement('option');
          option.value = output.id;
          option.innerText = output.name;
          clockOutputSelector.appendChild(option);
        }
        //$(clockOutputSelector).formSelect();
        onActiveClockOutputChange('none');

        while (clockInputSelector.firstChild) {
          clockInputSelector.firstChild.remove();
        }
        noneOption = document.createElement('option');
        noneOption.value = 'none';
        noneOption.innerText = 'None (using internal clock)';
        clockInputSelector.appendChild(noneOption);
        for (let input of WebMidi.inputs) {
          let option = document.createElement('option');
          option.value = input.id;
          option.innerText = input.name;
          clockInputSelector.appendChild(option);
        }
        //$(clockInputSelector).formSelect();
        onActiveClockInputChange('none');
      }

      function onActiveOutputChange(id) {
        if (activeOutput !== 'internal') {
          outputs[activeOutput] = null;
        }
        activeOutput = id;
        if (activeOutput !== 'internal') {
          let output = WebMidi.getOutputById(id);
          outputs[id] = {
            play: (drumIdx, velo, time) => {
              let delay = (time - Tone.now()) * 1000;
              let duration = (oneEighth / 2) * 1000;
              let velocity = { high: 1, med: 0.75, low: 0.5 };
              output.playNote(midiDrums[drumIdx], 1, {
                time: delay > 0 ? `+${delay}` : WebMidi.now,
                velocity,
                duration
              });
            }
          };
        }
        for (let option of Array.from(outputSelector.children)) {
          option.selected = option.value === id;
        }
      }

      function onActiveClockOutputChange(id) {
        if (activeClockOutput !== 'none') {
          stopSendingMidiClock();
        }
        activeClockOutput = id;
        if (activeClockOutput !== 'none') {
          startSendingMidiClock();
        }
        for (let option of Array.from(clockOutputSelector.children)) {
          option.selected = option.value === id;
        }
      }

      function startSendingMidiClock() {
        let output = WebMidi.getOutputById(activeClockOutput);
        midiClockSender = function(time, stepCounter) {
          let startDelay = time - Tone.now() + Tone.context.lookAhead;
          let sixteenth = Tone.Time('16n').toSeconds();
          for (let i = 0; i < 6; i++) {
            let tickDelay = startDelay + (sixteenth / 6) * i;
            if (i === 0 && stepCounter === 0 && !midiClockStartSent) {
              console.log('sending clock start');
              output.sendStart({ time: `+${tickDelay * 1000}` });
              midiClockStartSent = true;
            }
            output.sendClock({ time: `+${tickDelay * 1000}` });
          }
        };
      }

      function stopSendingMidiClock() {
        midiClockSender = null;
        midiClockStartSent = false;
      }

      function incomingMidiClockStart() {
        midiClockCounter = 0;
        eighthsCounter = 0;
        startPattern();
      }

      function incomingMidiClockStop() {
        midiClockCounter = 0;
        eighthsCounter = 0;
        lastEighthAt = null;
        stopPattern();
      }

      function incomingMidiClockTick(evt) {
        if (midiClockCounter % 6 === 0) {
          tick();
        }
        if (eighthsCounter % 12 === 0) {
          if (lastEighthAt) {
            oneEighth = (evt.timestamp - lastEighthAt) / 1000;
          }
          lastEighthAt = evt.timestamp;
        }
        midiClockCounter++;
        eighthsCounter++;
      }

      function onActiveClockInputChange(id) {
        if (activeClockInput === 'none') {
          Tone.Transport.clear(currentSchedulerId);
          currentSchedulerId = null;
        } else if (activeClockInput) {
          let input = WebMidi.getInputById(activeClockInput);
          input.removeListener('start', 'all', incomingMidiClockStart);
          input.removeListener('stop', 'all', incomingMidiClockStop);
          input.removeListener('clock', 'all', incomingMidiClockTick);
        }
        activeClockInput = id;
        if (activeClockInput === 'none') {
          currentSchedulerId = Tone.Transport.scheduleRepeat(tick, '16n');
          oneEighth = Tone.Time('8n').toSeconds();
        } else {
          let input = WebMidi.getInputById(id);
          input.addListener('start', 'all', incomingMidiClockStart);
          input.addListener('stop', 'all', incomingMidiClockStop);
          input.addListener('clock', 'all', incomingMidiClockTick);
        }
      }

      onDevicesChanged();
      WebMidi.addListener('connected', onDevicesChanged);
      WebMidi.addListener('disconnected', onDevicesChanged);



    })


  },[])


  const onPlayClick = (ev) => {
    ev.preventDefault();
    setPlaying(!playing)
    if (_.isNumber(stepCounter)) {
      stopPattern();
      Tone.Transport.pause();
    } else {
      Tone.context.resume();
      Tone.Transport.start();
      startPattern();
      hasBeenStarted = true;
    }
  }

  const onRegenerateClick = (ev) => {
    ev.preventDefault();
    const seed = _.take(pattern, seedLength)
    const generateLength = patternLength - seedLength
    worker.postMessage([seed, generateLength, temperature])
  }


  return (
    <>
      <div className="app">
        <div className="sequencer">
          <div className="steps">

            {pattern.map( (step, stepIdx) =>{
              return (
                <div className={`step ${(stepIdx < seedLength)? 'seed':''} ${(regenerating)? 'regenerating':''}`} key={stepIdx} style={{flex: (stepIdx % 2 === 0) ? swing : 1 - swing}}>
                  {DRUM_CLASSES.map( (drumClass, cellIdx) =>{
                    const on = step.indexOf(cellIdx) >= 0
                    return (
                      <div className={`cell ${(on)?'on':''} ${_.kebabCase(drumClass)}`} key={cellIdx} onClick={
                        (ev) => setPattern( pattern.map( (p,i) => (i===stepIdx) ? (on ? p.filter(s=>s!==cellIdx): [...p,cellIdx]) : p ) )
                      }>
                      </div>
                    )
                  })}
                </div>
              )
            })}

          </div>
        </div>
        <div className="controls">
          <div className="control">
            <a onClick={onPlayClick} className="playpause btn-floating btn-large waves-effect waves-light blue">
              <i className={`material-icons ${playing?'pause':'play'}-icon`}>{`${playing?'pause':'play_arrow'}`}</i>
            </a>
          </div>
          <div className="control">
            <a onClick={onRegenerateClick} className="regenerate btn-floating btn-large waves-effect waves-light pink darken-2">
              <i className="material-icons">refresh</i>
            </a>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" min="20" max="240" value={tempo} step="1" onChange={onTempoChange} /> Tempo
            </p>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" min="0.5" max="0.7" value={swing} step="0.05" onChange={onSwingChange} /> Swing
            </p>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" min="4" max="16" value={seedLength} step="1" onChange={onSeedLengthChange} /> Seed
            </p>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" min="4" max="32" value={patternLength} step="1" onChange={onPatternLengthChange} /> Length
            </p>
          </div>
          <div className="control">
            <p className="range-field grey-text">
              <input type="range" min="0.5" max="2" value={temperature} step="0.1" onChange={onTemperatureChange}  data-tooltip="Higher temperatures will make the neural network generates wilder patterns" data-delay="500"/>
               Temperature
            </p>
          </div>
        </div>
      </div>
      <div className="info">
        <p>
          Output:
          <select className="midi-output"></select>
        </p>
        <p>
          MIDI clock output:
          <select className="midi-clock-output"></select>
        </p>
        <p>
          MIDI clock input:
          <select className="midi-clock-input"></select>
        </p>
      </div>
    </>
  )
}

export default Codepen
