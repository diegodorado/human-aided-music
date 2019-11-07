import {PianoRollCanvasVisualizer} from "@magenta/music/node/core"

class PianoRoll extends PianoRollCanvasVisualizer {

  constructor(canvas){
    const config = {
          noteHeight: 6,
          noteSpacing: 1,
          pixelsPerTimeStep: 60,
          noteRGB: '8, 41, 64',
          activeNoteRGB: '240, 84, 119',
          minPitch: 34,
          maxPitch: 72,
        };
    const sequence = {notes:[],totalTime: 16}
    super(sequence, canvas, config)
  }

  update(seq){
    this.noteSequence = seq
    this.redraw()
  }


  redraw() {
    this.clear()
    for (let i = 0; i < this.noteSequence.notes.length; i++) {
      const note = this.noteSequence.notes[i]
      const size = this.getNotePosition(note, i)
      // Color of this note.
      const opacityBaseline = 0.2;  // Shift all the opacities up a little.
      const opacity = note.velocity ? note.velocity / 100 + opacityBaseline : 1;
      const isActive = !note.endTime
      const fill =
          `rgba(${isActive ? this.config.activeNoteRGB : this.config.noteRGB},
  ${opacity})`
      this.redrawNote(size.x, size.y, size.w, size.h, fill)
    }
  }


  getNotePosition(note, noteIndex) {
    // Size of this note.
    const x = (this.getNoteStartTime(note) * this.config.pixelsPerTimeStep);
    const w = this.config.pixelsPerTimeStep *
            (this.getNoteEndTime(note) - this.getNoteStartTime(note)) -
        this.config.noteSpacing;

    // The canvas' y=0 is at the top, but a smaller pitch is actually
    // lower, so we're kind of painting backwards.
    const y = this.height -
        ((note.pitch - this.config.minPitch) * this.config.noteHeight);

    return {x, y, w, h: this.config.noteHeight};
  }

  getNoteStartTime(note) {
    return Math.round(note.startTime * 100000000) / 100000000;
  }

  getNoteEndTime(note) {
    const endTime = note.endTime ? note.endTime : note.currTime
    return Math.round(endTime * 100000000) / 100000000
  }




}

export default PianoRoll
