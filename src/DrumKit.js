import Tone from 'tone'
import {reverseMidiMapping} from "./midiMapping"

const baseUrl = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699'

const drumKit = [
  new Tone.Players({
    high: `${baseUrl}/808-kick-vh.mp3`,
    med: `${baseUrl}/808-kick-vm.mp3`,
    low: `${baseUrl}/808-kick-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/flares-snare-vh.mp3`,
    med: `${baseUrl}/flares-snare-vm.mp3`,
    low: `${baseUrl}/flares-snare-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/808-hihat-vh.mp3`,
    med: `${baseUrl}/808-hihat-vm.mp3`,
    low: `${baseUrl}/808-hihat-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/808-hihat-open-vh.mp3`,
    med: `${baseUrl}/808-hihat-open-vm.mp3`,
    low: `${baseUrl}/808-hihat-open-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/slamdam-tom-low-vh.mp3`,
    med: `${baseUrl}/slamdam-tom-low-vm.mp3`,
    low: `${baseUrl}/slamdam-tom-low-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/slamdam-tom-mid-vh.mp3`,
    med: `${baseUrl}/slamdam-tom-mid-vm.mp3`,
    low: `${baseUrl}/slamdam-tom-mid-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/slamdam-tom-high-vh.mp3`,
    med: `${baseUrl}/slamdam-tom-high-vm.mp3`,
    low: `${baseUrl}/slamdam-tom-high-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/909-clap-vh.mp3`,
    med: `${baseUrl}/909-clap-vm.mp3`,
    low: `${baseUrl}/909-clap-vl.mp3`
  }).toMaster(),
  new Tone.Players({
    high: `${baseUrl}/909-rim-vh.wav`,
    med: `${baseUrl}/909-rim-vm.wav`,
    low: `${baseUrl}/909-rim-vl.wav`
  }).toMaster(),
];


const getVelocity = (vel) =>{
  if (vel > 90)
    return 'high'
  else if (vel >70)
    return 'med'
  else
    return 'low'
}

let ready = false
Tone.Buffer.on('load', () => ready = true)

const DrumKit ={
  setVolume: (vol) => drumKit.forEach(p => p.volume.value = vol),
  play: (note, time) => {
    if(!ready)
      return

    const idx = reverseMidiMapping.get(note.pitch)

    if(idx===undefined)
      console.error('not player for pitch '+note.pitch)
    else{
      //fixme: this create increasing linsteners
      // doesn t happen with synth drums
      drumKit[idx].get(getVelocity(note.velocity)).start(time)
    }
  }
}

export default DrumKit
