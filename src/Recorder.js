import {sequences} from "@magenta/music/node/core"
import {NoteSequence} from "@magenta/music/node/protobuf"
import Tone from 'tone'

const MILLIS_PER_SECOND = 1000


class Recorder {
  constructor(){
    this.config = {qpm: 120}
    this.callbackObject = {}
    this.midiInputs = []

  }

  start(midiInputs) {
    // Start listening to MIDI messages.
    for (const input of midiInputs) {
      input.onmidimessage = (event) => {
        this.midiMessageReceived(event)
      }
    }

    this.firstNoteTimestamp = Date.now()
    this.notes = []
    this.onNotes = new Map()

    this.step = 0
    this.cycleOffset = 0
    this._notes = []
    this.initCycleLoop()
  }

  initCycleLoop() {
    this.cycleLoop = new Tone.Loop((time) => {
      //8 measures is the total history length allowed
      const timeSpan = Tone.Time('8m')
      //filter out old notes, leaving one measure of blank space
      const timeSpanMinusGutter = Tone.Time('7m')
      this.notes = this.notes.filter(
          n => (time - n.startTime < timeSpanMinusGutter))

      //deep clone
      this._notes = Array.from(this.notes, n=> Object.assign({}, n))

      // Shift the sequence back to time 0
      this._notes.forEach(n => {
          n.startTime -= this.cycleOffset
          if(n.endTime)
            n.endTime -= this.cycleOffset
          else
            n.currTime = time-this.cycleOffset
          // wrap notes in a timespan cycle
          if(n.startTime < 0){
            n.startTime += timeSpan
            if(n.endTime) n.endTime += timeSpan
            if(n.currTime) n.currTime += timeSpan
          }
      })


      if((this.step % 256)===0){
        this.cycleOffset = time
      }

      // quarter
      if((this.step % 32)===0){
        const quarter = Math.floor(this.step / 32)
        const quarterTimeSpan = Tone.Time('2m')
        const notes = this.notes.filter(
            n => (n.endTime && time - n.startTime < quarterTimeSpan))
        //deep clone
        const _notes = Array.from(notes, n=> Object.assign({}, n))

        // Shift the sequence back to time 0
        _notes.forEach(n => {
            n.startTime -= (time-quarterTimeSpan)
            n.endTime -= (time-quarterTimeSpan)
        })

        const ns = NoteSequence.create({notes: _notes})
        const qns = sequences.quantizeNoteSequence(ns,4)
        this.callbackObject.runQuarter(qns,quarter)
      }

      this.step++

      const ns = NoteSequence.create({notes: this._notes})
      this.callbackObject.update(ns)

    }, '32n')
    Tone.Transport.bpm.value = this.config.qpm
    Tone.Transport.start()
    this.cycleLoop.start()
  }



  setTempo(qpm) {
    if (Tone.Transport.state === 'started')
      Tone.Transport.bpm.value = qpm
  }


  midiMessageReceived(event) {
    // event.timeStamp doesn't seem to work reliably across all
    // apps and controllers (sometimes it isn't set, sometimes it doesn't
    // change between notes). Use the performance now timing, unless it exists.
    let timeStampOffset;
    if (event.timeStamp !== undefined && event.timeStamp !== 0) {
      timeStampOffset = event.timeStamp;
    } else {
      timeStampOffset = performance.now();
    }
    const timeStamp = timeStampOffset + performance.timing.navigationStart;

    // MIDI commands we care about. See
    const NOTE_ON = 9
    const NOTE_OFF = 8

    const cmd = event.data[0] >> 4;
    const pitch = event.data[1];
    const velocity = (event.data.length > 2) ? event.data[2] : 1;
    const device = event.srcElement;

    // Some MIDI controllers don't send a separate NOTE_OFF command.
    if (cmd === NOTE_OFF || (cmd === NOTE_ON && velocity === 0)) {
      this.noteOff(pitch, timeStamp);
    } else if (cmd === NOTE_ON) {
      this.noteOn(pitch, velocity, timeStamp);
    }
  }



  noteOn(pitch, velocity, timeStamp) {
    const note = new NoteSequence.Note()
    note.pitch = pitch
    note.startTime = (timeStamp - this.firstNoteTimestamp) / MILLIS_PER_SECOND
    note.velocity = velocity

    this.callbackObject.noteOn(note)

    this.notes.push(note)
    // Save this note so that we can finish it when we receive the note up
    this.onNotes.set(pitch, note);
  }

  noteOff(pitch, timeStamp) {
    // Find the note that was originally pressed to finish it.
    const note = this.onNotes.get(pitch)
    if (note) {
      // Notes are saved in seconds, timestamps are in milliseconds.
      note.endTime = (timeStamp - this.firstNoteTimestamp) / MILLIS_PER_SECOND
    }
    this.onNotes.delete(pitch)
  }



}

export default Recorder
