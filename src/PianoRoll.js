import Tone from 'tone'

const MIN_PITCH = 34
const MAX_PITCH = 72

class PianoRoll {
  noteHeight= 6
  noteSpacing= 2
  pixelsWide= 960
  noteRGB= '8, 41, 64'
  activeNoteRGB= '240, 84, 119'
  height = 228
  constructor(canvas){
    this.ctx = canvas.getContext('2d')
    this.ctx.canvas.width = this.pixelsWide
    this.ctx.canvas.height = this.height
  }


  draw(notes) {
    this.minPitch = Math.min(...(notes.map(n=>n.pitch))) - 2
    this.maxPitch = Math.max(...(notes.map(n=>n.pitch))) + 2
    this.noteHeight = this.height /(this.maxPitch - this.minPitch)

    this.clear()
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      this.drawNote(note, !note.endTime)
    }
  }

  drawNote(note) {
    // get duration ... takes into account held notes
    const isActive = (n) => {
      const p = Tone.Transport.seconds / Tone.Transport.loopEnd
      return !n.endTime || ( p > note.position  && p < note.position + n.duration)
    }

    const size = this.getNotePosition(note)
    // Color of this note.
    const opacityBaseline = 0.2;  // Shift all the opacities up a little.
    const opacity = note.velocity ? note.velocity / 100 + opacityBaseline : 1;
    const active = isActive(note)
    const fill =`rgba(${active ? this.activeNoteRGB : this.noteRGB},${opacity})`
    this.ctx.fillStyle = fill
    this.ctx.fillRect(size.x, size.y, size.w, size.h)
  }


  getNotePosition(note) {
    // get duration ... takes into account held notes
    const dur = (n) =>
      n.endTime ? n.duration
        : (Tone.Transport.seconds<note.startTime ? Tone.Transport.loopEnd : (Tone.Transport.seconds-n.startTime))/Tone.Transport.loopEnd

    // Size of this note.
    const x = note.position * this.pixelsWide
    const w = dur(note) * this.pixelsWide

    // The canvas' y=0 is at the top, but a smaller pitch is actually
    // lower, so we're kind of painting backwards.
    const y = this.height - ((note.pitch - this.minPitch) * this.noteHeight)
    return { x, y, w, h: this.noteHeight }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
  }

}

export default PianoRoll
