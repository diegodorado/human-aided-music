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
];
const TIME_HUMANIZATION = 0.01;

let Tone = mm.Player.tone;

let sampleBaseUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699';

let reverb = new Tone.Convolver(
  `${sampleBaseUrl}/small-drum-room.wav`
).toMaster();
reverb.wet.value = 0.35;

let snarePanner = new Tone.Panner().connect(reverb);
new Tone.LFO(0.13, -0.25, 0.25).connect(snarePanner.pan).start();

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
let reverseMidiMapping = new Map([
  [36, 0],
  [35, 0],
  [38, 1],
  [27, 1],
  [28, 1],
  [31, 1],
  [32, 1],
  [33, 1],
  [34, 1],
  [37, 1],
  [39, 1],
  [40, 1],
  [56, 1],
  [65, 1],
  [66, 1],
  [75, 1],
  [85, 1],
  [42, 2],
  [44, 2],
  [54, 2],
  [68, 2],
  [69, 2],
  [70, 2],
  [71, 2],
  [73, 2],
  [78, 2],
  [80, 2],
  [46, 3],
  [67, 3],
  [72, 3],
  [74, 3],
  [79, 3],
  [81, 3],
  [45, 4],
  [29, 4],
  [41, 4],
  [61, 4],
  [64, 4],
  [84, 4],
  [48, 5],
  [47, 5],
  [60, 5],
  [63, 5],
  [77, 5],
  [86, 5],
  [87, 5],
  [50, 6],
  [30, 6],
  [43, 6],
  [62, 6],
  [76, 6],
  [83, 6],
  [49, 7],
  [55, 7],
  [57, 7],
  [58, 7],
  [51, 8],
  [52, 8],
  [53, 8],
  [59, 8],
  [82, 8]
]);

let temperature = 1.0;

let outputs = {
  internal: {
    play: (drumIdx, velocity, time) => {
      drumKit[drumIdx].get(velocity).start(time);
    }
  }
};

let rnn = new mm.MusicRNN(
  'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/drum_kit_rnn'
);
Promise.all([
  rnn.initialize(),
  new Promise(res => Tone.Buffer.on('load', res))
]).then(([vars]) => {
  let state = {
    patternLength: 32,
    seedLength: 4,
    swing: 0.55,
    pattern: [[0], [], [2]].concat(_.times(32, i => [])),
    tempo: 120
  };
  let stepEls = [],
    hasBeenStarted = false,
    oneEighth = Tone.Time('8n').toSeconds(),
    activeOutput = 'internal',
    midiClockSender = null,
    midiClockStartSent = false,
    activeClockInput = 'none',
    currentSchedulerId,
    stepCounter;

  function generatePattern(seed, length) {
    let seedSeq = toNoteSequence(seed);
    return rnn
      .continueSequence(seedSeq, length, temperature)
      .then(r => seed.concat(fromNoteSequence(r, length)));
  }

  function getStepVelocity(step) {
    if (step % 4 === 0) {
      return 'high';
    } else if (step % 2 === 0) {
      return 'med';
    } else {
      return 'low';
    }
  }

  function humanizeTime(time) {
    return time - TIME_HUMANIZATION / 2 + Math.random() * TIME_HUMANIZATION;
  }

  function tick(time = Tone.now() - Tone.context.lookAhead) {
    if (_.isNumber(stepCounter) && state.pattern) {
      stepCounter++;
      if (midiClockSender) midiClockSender(time, stepCounter);

      let stepIdx = stepCounter % state.pattern.length;
      let isSwung = stepIdx % 2 !== 0;
      if (isSwung) {
        time += (state.swing - 0.5) * oneEighth;
      }
      let velocity = getStepVelocity(stepIdx);
      let drums = state.pattern[stepIdx];
      drums.forEach(d => {
        let humanizedTime = stepIdx === 0 ? time : humanizeTime(time);
        outputs[activeOutput].play(d, velocity, humanizedTime);
        visualizePlay(humanizedTime, stepIdx, d);
      });
    }
  }

  function startPattern() {
    stepCounter = -1;
    midiClockStartSent = false;
    updatePlayPauseIcons();
  }

  function stopPattern() {
    stepCounter = null;
    updatePlayPauseIcons();
  }

  function visualizePlay(time, stepIdx, drumIdx) {
    Tone.Draw.schedule(() => {
      if (!stepEls[stepIdx]) return;
      let animTime = oneEighth * 4 * 1000;
      let cellEl = stepEls[stepIdx].cellEls[drumIdx];
      if (cellEl.classList.contains('on')) {
        let baseColor = stepIdx < state.seedLength ? '#e91e63' : '#64b5f6';
        cellEl.animate(
          [
            {
              transform: 'translateZ(-100px)',
              backgroundColor: '#fad1df'
            },
            {
              transform: 'translateZ(50px)',
              offset: 0.7
            },
            { transform: 'translateZ(0)', backgroundColor: baseColor }
          ],
          { duration: animTime, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
        );
      }
    }, time);
  }

  function renderPattern(regenerating = false) {
    let seqEl = document.querySelector('.sequencer .steps');
    while (stepEls.length > state.pattern.length) {
      let { stepEl, gutterEl } = stepEls.pop();
      stepEl.remove();
      if (gutterEl) gutterEl.remove();
    }
    for (let stepIdx = 0; stepIdx < state.pattern.length; stepIdx++) {
      let step = state.pattern[stepIdx];
      let stepEl, gutterEl, cellEls;
      if (stepEls[stepIdx]) {
        stepEl = stepEls[stepIdx].stepEl;
        gutterEl = stepEls[stepIdx].gutterEl;
        cellEls = stepEls[stepIdx].cellEls;
      } else {
        stepEl = document.createElement('div');
        stepEl.classList.add('step');
        stepEl.dataset.stepIdx = stepIdx;
        seqEl.appendChild(stepEl);
        cellEls = [];
      }

      stepEl.style.flex = stepIdx % 2 === 0 ? state.swing : 1 - state.swing;

      if (!gutterEl && stepIdx < state.pattern.length - 1) {
        gutterEl = document.createElement('div');
        gutterEl.classList.add('gutter');
        seqEl.insertBefore(gutterEl, stepEl.nextSibling);
      } else if (gutterEl && stepIdx >= state.pattern.length) {
        gutterEl.remove();
        gutterEl = null;
      }

      if (gutterEl && stepIdx === state.seedLength - 1) {
        gutterEl.classList.add('seed-marker');
      } else if (gutterEl) {
        gutterEl.classList.remove('seed-marker');
      }

      for (let cellIdx = 0; cellIdx < DRUM_CLASSES.length; cellIdx++) {
        let cellEl;
        if (cellEls[cellIdx]) {
          cellEl = cellEls[cellIdx];
        } else {
          cellEl = document.createElement('div');
          cellEl.classList.add('cell');
          cellEl.classList.add(_.kebabCase(DRUM_CLASSES[cellIdx]));
          cellEl.dataset.stepIdx = stepIdx;
          cellEl.dataset.cellIdx = cellIdx;
          stepEl.appendChild(cellEl);
          cellEls[cellIdx] = cellEl;
        }
        if (step.indexOf(cellIdx) >= 0) {
          cellEl.classList.add('on');
        } else {
          cellEl.classList.remove('on');
        }
      }
      stepEls[stepIdx] = { stepEl, gutterEl, cellEls };

      let stagger = stepIdx * (300 / (state.patternLength - state.seedLength));
      setTimeout(() => {
        if (stepIdx < state.seedLength) {
          stepEl.classList.add('seed');
        } else {
          stepEl.classList.remove('seed');
          if (regenerating) {
            stepEl.classList.add('regenerating');
          } else {
            stepEl.classList.remove('regenerating');
          }
        }
      }, stagger);
    }

    setTimeout(repositionRegenerateButton, 0);
  }

  function repositionRegenerateButton() {
    let regenButton = document.querySelector('.regenerate');
    let sequencerEl = document.querySelector('.sequencer');
    let seedMarkerEl = document.querySelector('.gutter.seed-marker');
    let regenLeft =
      sequencerEl.offsetLeft +
      seedMarkerEl.offsetLeft +
      seedMarkerEl.offsetWidth / 2 -
      regenButton.offsetWidth / 2;
    let regenTop =
      sequencerEl.offsetTop +
      seedMarkerEl.offsetTop +
      seedMarkerEl.offsetHeight / 2 -
      regenButton.offsetHeight / 2;
    regenButton.style.left = `${regenLeft}px`;
    regenButton.style.top = `${regenTop}px`;
    regenButton.style.visibility = 'visible';
  }

  function regenerate() {
    let seed = _.take(state.pattern, state.seedLength);
    renderPattern(true);
    return generatePattern(seed, state.patternLength - seed.length).then(
      result => {
        state.pattern = result;
        onPatternUpdated();
      }
    );
  }

  function onPatternUpdated() {
    stopPattern();
    renderPattern();
  }

  function toggleStep(cellEl) {
    if (state.pattern && cellEl.classList.contains('cell')) {
      let stepIdx = +cellEl.dataset.stepIdx;
      let cellIdx = +cellEl.dataset.cellIdx;
      let isOn = cellEl.classList.contains('on');
      if (isOn) {
        _.pull(state.pattern[stepIdx], cellIdx);
        cellEl.classList.remove('on');
      } else {
        state.pattern[stepIdx].push(cellIdx);
        cellEl.classList.add('on');
      }
    }
  }

  function toNoteSequence(pattern) {
    return mm.sequences.quantizeNoteSequence(
      {
        ticksPerQuarter: 220,
        totalTime: pattern.length / 2,
        timeSignatures: [
          {
            time: 0,
            numerator: 4,
            denominator: 4
          }
        ],
        tempos: [
          {
            time: 0,
            qpm: 120
          }
        ],
        notes: _.flatMap(pattern, (step, index) =>
          step.map(d => ({
            pitch: midiDrums[d],
            startTime: index * 0.5,
            endTime: (index + 1) * 0.5
          }))
        )
      },
      1
    );
  }

  function fromNoteSequence(seq, patternLength) {
    let res = _.times(patternLength, () => []);
    for (let { pitch, quantizedStartStep } of seq.notes) {
      res[quantizedStartStep].push(reverseMidiMapping.get(pitch));
    }
    return res;
  }

  function setSwing(newSwing) {
    state.swing = newSwing;
    renderPattern();
  }

  function updatePlayPauseIcons() {
    if (_.isNumber(stepCounter)) {
      document.querySelector('.playpause .pause-icon').style.display = null;
      document.querySelector('.playpause .play-icon').style.display = 'none';
    } else {
      document.querySelector('.playpause .play-icon').style.display = null;
      document.querySelector('.playpause .pause-icon').style.display = 'none';
    }
  }

  WebMidi.enable(err => {
    if (err) {
      console.error('WebMidi could not be enabled', err);
      return;
    }
    document
      .querySelectorAll('.webmidi-enabled')
      .forEach(e => (e.style.display = 'block'));
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
      $(outputSelector).formSelect();
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
      $(clockOutputSelector).formSelect();
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
      $(clockInputSelector).formSelect();
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

    $(outputSelector)
      .on('change', evt => onActiveOutputChange(evt.target.value))
      .formSelect();
    $(clockOutputSelector)
      .on('change', evt => onActiveClockOutputChange(evt.target.value))
      .formSelect();
    $(clockInputSelector)
      .on('change', evt => onActiveClockInputChange(evt.target.value))
      .formSelect();
  });

  document.querySelector('.app').addEventListener('click', event => {
    if (event.target.classList.contains('cell')) {
      toggleStep(event.target);
    }
  });
  document.querySelector('.regenerate').addEventListener('click', event => {
    event.preventDefault();
    event.currentTarget.classList.remove('pulse');
    document.querySelector('.playpause').classList.remove('pulse');
    regenerate().then(() => {
      if (!hasBeenStarted) {
        Tone.context.resume();
        Tone.Transport.start();
        hasBeenStarted = true;
      }
      if (Tone.Transport.state === 'started') {
        setTimeout(startPattern, 0);
      }
    });
  });
  document.querySelector('.playpause').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('.playpause').classList.remove('pulse');
    if (_.isNumber(stepCounter)) {
      stopPattern();
      Tone.Transport.pause();
    } else {
      Tone.context.resume();
      Tone.Transport.start();
      startPattern();
      hasBeenStarted = true;
    }
  });

  let draggingSeedMarker = false;
  document.querySelector('.app').addEventListener('mousedown', evt => {
    let el = evt.target;
    if (
      el.classList.contains('gutter') &&
      el.classList.contains('seed-marker')
    ) {
      draggingSeedMarker = true;
      evt.preventDefault();
    }
  });
  document.querySelector('.app').addEventListener('mouseup', () => {
    draggingSeedMarker = false;
  });
  document.querySelector('.app').addEventListener('mouseover', evt => {
    if (draggingSeedMarker) {
      let el = evt.target;
      while (el) {
        if (el.classList.contains('step')) {
          let stepIdx = +el.dataset.stepIdx;
          if (stepIdx > 0) {
            state.seedLength = stepIdx;
            renderPattern();
          }
          break;
        }
        el = el.parentElement;
      }
    }
  });
  document
    .querySelector('#swing')
    .addEventListener('input', evt => setSwing(+evt.target.value));
  document
    .querySelector('#temperature')
    .addEventListener('input', evt => (temperature = +evt.target.value));
  document.querySelector('#tempo').addEventListener('input', evt => {
    Tone.Transport.bpm.value = state.tempo = +evt.target.value;
    oneEighth = Tone.Time('8n').toSeconds();
  });

  $('#pattern-length')
    .on('change', evt => setPatternLength(+evt.target.value))
    .formSelect();

  window.addEventListener('resize', repositionRegenerateButton);

  renderPattern();

  document.querySelector('.progress').remove();
  document.querySelector('.app').style.display = null;
});
