import {MusicRNN} from "@magenta/music/node/music_rnn"
import {sequences} from "@magenta/music/node/core"
import {midiMapping, reverseMidiMapping} from "./midiMapping"

import _ from 'lodash'

const rnn = new MusicRNN(
  'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/drum_kit_rnn'
)

function toNoteSequence(pattern) {
  return sequences.quantizeNoteSequence(
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
          pitch: midiMapping[d],
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


rnn.initialize().then( console.log('yep, initialized!'))

self.addEventListener('message', (ev)=>{
  try {
    const [seed, generateLength, temperature] = ev.data
    generate(seed, generateLength, temperature).then( r => postMessage(r))
  } catch (err) {
    console.error(err)
  }
})

async function generate(seed, generateLength, temperature) {
  let start = performance.now()
  const seedSeq = toNoteSequence(seed)
  const r = await rnn.continueSequence(seedSeq, generateLength, temperature)
  console.log('rnn.continueSequence', start)
  return seed.concat(fromNoteSequence(r, generateLength))
}
