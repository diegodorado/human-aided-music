import Tone from 'tone'
import {midiMapping, reverseMidiMapping} from "./midiMapping"

const kick = new Tone.MembraneSynth().toMaster()
const tomLow = new Tone
                     .MembraneSynth({
                       pitchDecay: 0.008,
                       envelope: {attack: 0.01, decay: 0.5, sustain: 0}
                     })
                     .toMaster();
const tomMid = new Tone
                     .MembraneSynth({
                       pitchDecay: 0.008,
                       envelope: {attack: 0.01, decay: 0.5, sustain: 0}
                     })
                     .toMaster();
const tomHigh = new Tone
                      .MembraneSynth({
                        pitchDecay: 0.008,
                        envelope: {attack: 0.01, decay: 0.5, sustain: 0}
                      })
                      .toMaster();
const closedHihat =
    new Tone
        .MetalSynth({
          frequency: 400,
          envelope: {attack: 0.001, decay: 0.1, release: 0.8},
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1
        })
        .toMaster();
const openHihat =
    new Tone
        .MetalSynth({
          frequency: 400,
          envelope: {attack: 0.001, decay: 0.5, release: 0.8, sustain: 1},
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1
        })
        .toMaster();
const ride = new Tone.MetalSynth().toMaster();
const crash = new Tone
                    .MetalSynth({
                      frequency: 300,
                      envelope: {attack: 0.001, decay: 1, release: 3},
                      harmonicity: 5.1,
                      modulationIndex: 64,
                      resonance: 4000,
                      octaves: 1.5
                    })
                    .toMaster();
const snare =
    new Tone
        .NoiseSynth({
          noise: {type: 'white'},
          envelope: {attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.4}
        })
        .toMaster();
const loClick = new Tone
                      .MembraneSynth({
                        pitchDecay: 0.008,
                        envelope: {attack: 0.001, decay: 0.3, sustain: 0}
                      })
                      .toMaster();
const hiClick = new Tone
                      .MembraneSynth({
                        pitchDecay: 0.008,
                        envelope: {attack: 0.001, decay: 0.3, sustain: 0}
                      })
                      .toMaster();
const pitchPlayers = [
  (time, velocity = 1) =>
      kick.triggerAttackRelease('C2', '8n', time, velocity),
  (time, velocity = 1) =>
      snare.triggerAttackRelease('16n', time, velocity),
  (time, velocity = 1) =>
      closedHihat.triggerAttack(time, 0.3, velocity),
  (time, velocity = 1) =>
      openHihat.triggerAttack(time, 0.3, velocity),
  (time, velocity = 0.5) =>
      tomLow.triggerAttack('G3', time, velocity),
  (time, velocity = 0.5) =>
      tomMid.triggerAttack('C4', time, velocity),
  (time, velocity = 0.5) =>
      tomHigh.triggerAttack('F4', time, velocity),
  (time, velocity = 1) =>
      crash.triggerAttack(time, 1.0, velocity),
  (time, velocity = 1) =>
      ride.triggerAttack(time, 0.5, velocity),
  (time, velocity = 0.5) =>
      loClick.triggerAttack('G5', time, velocity),
  (time, velocity = 0.5) =>
      hiClick.triggerAttack('C6', time, velocity)
]

const DrumKit ={
  play: (pitch, time, velocity) => {
      const idx = reverseMidiMapping.get(pitch)
      if(idx===undefined)
        console.log('not player for pitch '+pitch)
      else
        pitchPlayers[idx](time, velocity)
    }
}

export default DrumKit
