import Tone from 'tone'

class PianoRoll {
  constructor(canvas){
    this.config = {
      noteHeight: 6,
      noteSpacing: 1,
      pixelsWide: 960,
      noteRGB: '8, 41, 64',
      activeNoteRGB: '240, 84, 119',
      minPitch: 34,
      maxPitch: 72,
    }

    this.height = (this.config.maxPitch - this.config.minPitch) * this.config.noteHeight

    // Initialize the canvas.
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.canvas.width = this.config.pixelsWide
      this.ctx.canvas.height = this.height;
    }

  }


  draw(notes) {
    this.clear()
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      this.drawNote(note, !note.endTime)
    }
  }

  drawNote(note, active) {
      const size = this.getNotePosition(note)
      // Color of this note.
      const opacityBaseline = 0.2;  // Shift all the opacities up a little.
      const opacity = note.velocity ? note.velocity / 100 + opacityBaseline : 1;
      active |= !note.endTime
      const fill =
          `rgba(${active ? this.config.activeNoteRGB : this.config.noteRGB},
  ${opacity})`
     this.ctx.fillStyle = fill
     this.ctx.fillRect(size.x, size.y, size.w, size.h)
  }


  getNotePosition(note) {
       // Size of this note.
       const x = (this.getNoteStart(note) * this.config.pixelsWide)
       const w = this.config.pixelsWide *
           (this.getNoteEnd(note) - this.getNoteStart(note))
       // The canvas' y=0 is at the top, but a smaller pitch is actually
       // lower, so we're kind of painting backwards.
       const y = this.height -
           ((note.pitch - this.config.minPitch) * this.config.noteHeight)
       return { x, y, w, h: this.config.noteHeight }
  }

  getNoteStart(note) {
    return Math.round(note.startTime/Tone.Time('8m') * 100000000) / 100000000
  }

  getNoteEnd(note) {
    let endTime = note.endTime ? note.endTime : Tone.Transport.seconds
    endTime = (endTime>=note.startTime) ? endTime : (endTime+Tone.Time('8m'))
    return Math.round(endTime/Tone.Time('8m') * 100000000) / 100000000
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }

}

export default PianoRoll
