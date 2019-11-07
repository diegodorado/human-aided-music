import Tone from 'tone'
import {midiMapping, reverseMidiMapping} from "./midiMapping"

const kick = new Tone.MembraneSynth().toMaster()
const tomLow = new Tone
                     .MembraneSynth({
                       pitchDecay: 0.008,
                       envelope: {attack: 0.01, decay: 0.5, sustain: 0}
                     })
                     .toMaster()
const tomMid = new Tone
                     .MembraneSynth({
                       pitchDecay: 0.008,
                       envelope: {attack: 0.01, decay: 0.5, sustain: 0}
                     })
                     .toMaster()
const tomHigh = new Tone
                      .MembraneSynth({
                        pitchDecay: 0.008,
                        envelope: {attack: 0.01, decay: 0.5, sustain: 0}
                      })
                      .toMaster()
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
        .toMaster()
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
        .toMaster()
const ride = new Tone.MetalSynth().toMaster()
const crash = new Tone
                    .MetalSynth({
                      frequency: 300,
                      envelope: {attack: 0.001, decay: 1, release: 3},
                      harmonicity: 5.1,
                      modulationIndex: 64,
                      resonance: 4000,
                      octaves: 1.5
                    })
                    .toMaster()
const snare =
    new Tone
        .NoiseSynth({
          noise: {type: 'white'},
          envelope: {attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.4}
        })
        .toMaster()
const loClick = new Tone
                      .MembraneSynth({
                        pitchDecay: 0.008,
                        envelope: {attack: 0.001, decay: 0.3, sustain: 0}
                      })
                      .toMaster()
const hiClick = new Tone
                      .MembraneSynth({
                        pitchDecay: 0.008,
                        envelope: {attack: 0.001, decay: 0.3, sustain: 0}
                      })
                      .toMaster()
const pitchPlayers = [
  (dur, vel) => kick.triggerAttackRelease('C2', '8n', dur, vel),
  (dur, vel) => snare.triggerAttackRelease('16n', dur, vel),
  (dur, vel) => closedHihat.triggerAttack(dur, 0.3, vel),
  (dur, vel) => openHihat.triggerAttack(dur, 0.3, vel),
  (dur, vel) => tomLow.triggerAttack('G3', dur, vel),
  (dur, vel) => tomMid.triggerAttack('C4', dur, vel),
  (dur, vel) => tomHigh.triggerAttack('F4', dur, vel),
  (dur, vel) => crash.triggerAttack(dur, 1.0, vel),
  (dur, vel) => ride.triggerAttack(dur, 0.5, vel),
  (dur, vel) => loClick.triggerAttack('G5', dur, vel),
  (dur, vel) => hiClick.triggerAttack('C6', dur, vel)
]

const DrumKit ={
  play: (note) => {
    const idx = reverseMidiMapping.get(note.pitch)

    if(idx===undefined)
      console.log('not player for pitch '+note.pitch)
    else
      pitchPlayers[idx](Tone.now(), note.velocity/127)
  }
}

export default DrumKit
