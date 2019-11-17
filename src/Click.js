import Tone from 'tone'

let beatStep = 0
let active = false

const click = new Tone.MembraneSynth(
      {pitchDecay: 0.008,envelope: {attack: 0.001, decay: 0.3, sustain: 0}}
    ).toMaster()

click.volume.value = -12

Tone.Transport.scheduleRepeat( (time) => {
  if(active)
    click.triggerAttack((beatStep===0) ? 'C6' : 'G5')
  beatStep++
  beatStep%=4
}, '4n')

export const changeClickActive = act => active = act
export const setClickVolume = vol => click.volume.value = vol
