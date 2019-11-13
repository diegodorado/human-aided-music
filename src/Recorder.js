import {NoteSequence} from "@magenta/music/node/protobuf"
import Tone from 'tone'

class Recorder {

  constructor(){
    this.notes = []
    this.onNotes = new Map()
  }

  noteOn = (data) =>{
    const note = new NoteSequence.Note()
    note.pitch = data.pitch
    note.startTime = Tone.Transport.seconds
    note.velocity = data.velocity

    note.position = note.startTime/Tone.Transport.loopEnd
    note.loopEnd = Tone.Transport.loopEnd
    this.notes.push(note)
    // Save this note so that we can finish it when we receive the note up
    this.onNotes.set(data.pitch, note);
  }

  noteOff = (data) =>{
    // Find the note that was originally pressed to finish it.
    const note = this.onNotes.get(data.pitch)
    if (note) {
      // Notes are saved in seconds, timestamps are in milliseconds.
      note.endTime = Tone.Transport.seconds
      const loopEnd = Tone.Transport.loopEnd
      const endTime = (note.endTime<note.startTime ? loopEnd :note.endTime)
      note.duration = (endTime-note.startTime)/loopEnd
    }
    this.onNotes.delete(data.pitch)
  }

}

export default Recorder
