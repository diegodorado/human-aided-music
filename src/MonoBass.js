import Tone from 'tone'

//a bass synth made of two other synths

const onNotes = new Set()

const synth1 = new Tone.MonoSynth({
	"oscillator" : {
		"type" : "square"
 },
 "envelope" : {
 	"attack" : 0.1
 }
}).toMaster()

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
      sustain: 0.834,
      release: 0.84
    } ,
    modulation : {
      type : 'square'
    } ,
    modulationEnvelope : {
      attack : 0.0015 ,
      decay : 0 ,
      sustain : 1 ,
      release : 0.5
    }
  }).toMaster()


const getLastValue = (set) =>{
  var value;
  for(value of set);
  return value;
}


class MonoBass {
  noteOn = (note) =>{
    if(onNotes.has(note.pitch)){
      console.log('note on twice!')
      return
    }
    const triggerAttack = (onNotes.size ===0)
    this.setNote(note.pitch, triggerAttack)
    onNotes.add(note.pitch)
  }

  noteOff = (note) =>{
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
