

export const ns_strech = (ns, qpm) => {
  // stretch manually
  const prev_qpm = ns.tempos[0].qpm
  ns.tempos[0].qpm = qpm
  for ( let j= 0; j< ns.notes.length; j++){
    ns.notes[j].startTime *= (prev_qpm/qpm)
    ns.notes[j].endTime *= (prev_qpm/qpm)
  }
}
