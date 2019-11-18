import {GUI} from 'dat.gui'


const gui = new GUI({autoPlace: false})
let input = null
let output = null

//nasty hack to dat.gui
function blurMe(){
  if(this.__checkbox)
    this.__checkbox.blur()
  else if(this.__select)
    this.__select.blur()
}

export const setupGUI = (guiEl, options, monoBass,DrumKit, changeClickActive, setClickVolume, setTempo) =>{

  //save and recall settings from localstorage
  gui.useLocalStorage = true
  gui.remember(options)
  //fucking no typed shit
  options.subdivisions = parseInt(options.subdivisions)

  guiEl.appendChild(gui.domElement)

  gui.add(options, 'useSynth').name('Use Synth').onChange(monoBass.setActive).onFinishChange(blurMe)
  gui.add(options, 'synthVolume', -60, 0).name('Synth Volume').onChange(monoBass.setVolume)
  gui.add(options, 'playClick').name('Play Click').onChange(changeClickActive).onFinishChange(blurMe)
  gui.add(options, 'clickVolume', -60, 0).name('Click Volume').onChange(setClickVolume)
  gui.add(options, 'drumsVolume', -60, 0).name('Drums Volume').onChange(DrumKit.setVolume)
  gui.add(options, 'strategy', ['generate','tap2drum','generate_groove','groove','continue','continue_groove','tap_or_continue','interpolate']).name('Strategy').onFinishChange(blurMe)
  gui.add(options, 'temperature', 0.0, 2.0).name('Temperature')
  gui.add(options, 'qpm', 60, 180).name('Tempo').step(1).onChange(setTempo)
  input = gui.add(options, 'input',[])
  output = gui.add(options, 'output',[])
  gui.add(options, 'subdivisions', [4,8,16]).name('Subdivisions').onChange((v)=>{
    //fucking no typed shit
    options.subdivisions = parseInt(v)
  }).onFinishChange(blurMe)
  gui.add(options, 'interpolateFor', 0, 8).step(1)
  gui.add(options, 'repeatFor', 0, 8).step(1)



  //set remembered values
  monoBass.setActive(options.useSynth)
  monoBass.setVolume(options.synthVolume)
  changeClickActive(options.playClick)
  setClickVolume(options.clickVolume)
  DrumKit.setVolume(options.drumsVolume)
  setTempo(options.qpm)

}

/*midi devices changed handler*/
export const onMidiDevicesChanged = (m) =>{
  // unfortunatelly, dat.gui has no means of
  // updating controller options without recreating it
  // so, onchange handler has to be bound here
  const inputs = { 'All Midi Inputs': 'all',  'Computer Keyboard': 'keyboard'}
  m.midiInputs.forEach(i => inputs[i.name] = i.id)
  input = input.options(inputs).name('Input').onFinishChange(blurMe)

  const outputs = { 'No Output': 'none','WebAudio Drum': 'webaudio'}
  m.midiOutputs.forEach(i => outputs[i.name] = i.id)
  output = output.options(outputs).name('Output').onFinishChange(blurMe)
}
