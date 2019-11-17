import Tone from 'tone'

//a bass synth made of two other synths

const onNotes = new Set()


const synth1 = new Tone.MonoSynth({
	oscillator : {
		type : "square"
 },
 envelope : {
 	attack : 0.001,
	sustain: 0.06
 }
})


const synth2 = new Tone.FMSynth(
  {
    harmonicity : 1 ,
    modulationIndex : 1 ,
    detune : 0 ,
    oscillator : {
      type : 'sawtooth'
    } ,
    envelope : {
      attack : 0.001,
      decay : 0.12,
      sustain: 0.1,
      release: 0.84
    } ,
    modulation : {
      type : 'square'
    } ,
    modulationEnvelope : {
      attack : 0.15 ,
      decay : 0 ,
      sustain : 0.25 ,
      release : 0.5
    }
  })

const filter = new Tone.Filter(2000, "lowpass")
const dist = new Tone.Distortion(0.95)

const channel = new Tone.Channel()
synth1.connect(channel)
synth2.connect(channel)

channel.connect(dist)
dist.connect(filter)

filter.toMaster()

const getLastValue = (set) =>{
  var value;
  for(value of set);
  return value;
}


class MonoBass {
	active = true

	setVolume = (vol) => {
    synth1.volume.value = vol
    synth2.volume.value = vol
	}

	setActive = (active) =>{
		this.active = active
		//release any active note
		if(!active && onNotes.size>0){
      this.triggerRelease()
			onNotes.clear()
		}
	}

  noteOn = (note) =>{
		if(!this.active)
			return

    const triggerAttack = (onNotes.size ===0)
    this.setNote(note.pitch, triggerAttack)
    onNotes.add(note.pitch)
  }

  noteOff = (note) =>{
		if(!this.active)
			return

    onNotes.delete(note.pitch)

    // triggerRelease?
    if(onNotes.size ===0){
      this.triggerRelease()
    }else{
      const prev = getLastValue(onNotes)
      this.setNote(prev, false)
    }
  }


  setNote = (pitch, trigger) =>{
    const a = Tone.Frequency(pitch, "midi").toNote()
    // triggerAttack?
    if(trigger){
      synth1.triggerAttack(a)
      synth2.triggerAttack(a)
    }else{
      synth1.setNote(a)
      synth2.setNote(a)
    }
  }

  triggerRelease = (pitch, trigger) =>{
    synth1.triggerRelease()
    synth2.triggerRelease()
  }


}

export default MonoBass
