import AudioKeys from 'audiokeys'

const keyboard = new AudioKeys({polyphony: 1,rows: 1, rootNote: 48})

export const setupKeyboard = (options, noteOn,noteOff) =>{
  keyboard.down( n => (options.input === 'keyboard') && noteOn ({ pitch: n.note, velocity:100}) )
  keyboard.up( n => (options.input === 'keyboard') && noteOff ({ pitch: n.note, velocity:0}) )
}
