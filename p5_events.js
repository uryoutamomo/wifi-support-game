/* ============================================================
   イベント
   ============================================================ */

function triggerAudioRecoveryFromGesture(target){
  const button = target && target.closest('[data-audio-unlock]');
  if (!button || button.disabled) return false;
  unlockAudioFromGesture().then(ready => { if (ready) playAudioTestSound(); });
  return true;
}

document.addEventListener('click', (e) => {
  if (triggerAudioRecoveryFromGesture(e.target)) return;
  const soundToggle = e.target.closest('[data-sound-toggle]');
  if (soundToggle){ toggleSoundFromGesture(); return; }
  if (timePassage){
    const answerDuringPassage = e.target.closest('[data-office-answer]');
    finishTimePassage();
    if (!answerDuringPassage) return;
  }
  if (typingLine){ finishTyping(); return; }
  const el = e.target.closest('[data-office-answer],[data-office-callback],[data-office-desk],[data-office-verify],[data-device-verification-check],[data-device-verification-close],[data-desk],[data-desk-ticket],[data-desk-lookup],[data-callback-destination],[data-hotel-callback],[data-front-desk],[data-command],[data-greet],[data-end-call],[data-finish-call],[data-ask-group],[data-ask],[data-smalltalk],[data-tell],[data-refund],[data-refund-confirm],[data-refund-cancel],[data-soothe],[data-apology],[data-lookup],[data-lookup-mode],[data-lookup-back],[data-test],[data-cause],[data-remedy],[data-ship-level],[data-ship-confirm],[data-report-submit],[data-close-confirm],[data-late-name]');
  if (!el || el.disabled) return;
  const audioReady = unlockAudioFromGesture();
  audioReady.then(ready => { if (ready) playCommandSound(); });
  routeAction(el.dataset);
});

function noteAudioInterruption(event){
  if (!GAME_FLAGS.soundEnabled || !audioContext) return;
  const backgrounded = event && event.type === 'pagehide';
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  if (backgrounded || hidden || audioContext.state !== 'running') setAudioUnlockStatus('needs_gesture');
}

document.addEventListener('visibilitychange', noteAudioInterruption);
window.addEventListener('pagehide', noteAudioInterruption);
window.addEventListener('pageshow', noteAudioInterruption);

function firstTicketIn(stateName, orderKey){
  return state.tickets
    .filter(ticket => ticket.state === stateName)
    .sort((a, b) => a[orderKey] - b[orderKey])[0];
}

function handleOfficeAction(d){
  if (d.officeAnswer){
    const t = firstTicketIn('waiting', 'arrivedTurn');
    if (t) pickup(t);
    return true;
  }
  if (d.officeCallback){
    const t = state.tickets.filter(ticket => ticket.state === 'callback' && ticket.callbackDue <= state.clock).sort((a,b) => a.callbackDue - b.callbackDue)[0];
    if (t) resumeCallback(t);
    return true;
  }
  if (d.officeDesk){ openDeskLookup(); return true; }
  if (d.officeVerify){ state.deviceVerificationFeedback = ''; showDeviceVerification(); return true; }
  if (d.deviceVerificationClose){ closeSheet(); renderOffice(); return true; }
  if (d.deviceVerificationCheck){
    const knownAction = DEVICE_VERIFICATION_ACTIONS.some(action => action.id === d.deviceVerificationCheck);
    if (knownAction) closeSheet();
    const result = chooseDeviceVerification(d.deviceVerificationCheck);
    if (!result.accepted || (result.attemptFinished && !result.completed)) showDeviceVerification();
    return true;
  }
  return false;
}

function handleDeskAction(d){
  if (d.desk === 'close'){ closeDeskLookup(); return true; }
  if (d.deskTicket){ selectDeskTicket(d.deskTicket); return true; }
  if (d.deskLookup){ doDeskLookup(d.deskLookup); return true; }
  return false;
}

function handleCallNavigation(d){
  if (d.callbackDestination){ startCarrierCallback(d.callbackDestination); return true; }
  if (d.hotelCallback){ startHotelCallback(d.hotelCallback); return true; }
  if (d.frontDesk){ handleFrontDeskChoice(d.frontDesk); return true; }
  if (d.finishCall){
    const t = state.focus;
    if (!t) return true;
    if (t.pendingResult) finishResolvedCall(t);
    return true;
  }
  if (d.endCall){
    const t = state.focus;
    if (t) endCurrentCall(t);
    return true;
  }
  if (d.greet){ greetCurrentCustomer(); return true; }
  if (d.command){
    if (d.command === 'record') openRecord();
    else if (d.command === 'lookup') openLookup();
    else { state.ui = defaultUi(d.command); render(); }
    return true;
  }
  if (d.askGroup){ state.ui.askGroup = d.askGroup; render(); return true; }
  if (d.tell){ state.ui = defaultUi(d.tell); render(); return true; }
  return false;
}

function handleConversationAction(d){
  if (d.ask){ doAsk(d.ask); return true; }
  if (d.smalltalk){ doSmalltalk(d.smalltalk, d.smalltalkMode); return true; }
  if (d.refund){ if (!state.focus.refundProposalRejected) state.ui = defaultUi('refund_confirm'); render(); return true; }
  if (d.refundConfirm){ doRefund(); return true; }
  if (d.refundCancel){ state.ui = defaultUi('tell'); render(); return true; }
  if (d.soothe){ doSoothe(d.soothe); return true; }
  if (d.apology){ doApologize(d.apology); return true; }
  if (d.lookup){ state.ui.lookup = d.lookup; render(); return true; }
  if (d.lookupMode){ doLookup(state.ui.lookup, d.lookupMode); return true; }
  if (d.lookupBack){ state.ui.lookup = null; render(); return true; }
  if (d.test){ doTest(d.test); return true; }
  return false;
}

function handleResolutionAction(d){
  if (d.cause){
    state.ui.cause = (d.cause === '__back') ? null : d.cause;
    state.ui.remedy = null;
    render();
    return true;
  }
  if (d.remedy){ chooseRemedy(d.remedy); return true; }
  if (d.shipLevel){ chooseShipLevel(d.shipLevel); return true; }
  if (d.shipConfirm){ confirmShipment(); return true; }
  if (d.reportSubmit){ submitReport(); return true; }
  if (d.closeConfirm){ doClose(state.ui.cause, state.ui.remedy); return true; }
  if (d.lateName){ askLateName(); return true; }
  return false;
}

function routeAction(d){
  [handleOfficeAction, handleDeskAction, handleCallNavigation, handleConversationAction, handleResolutionAction]
    .some(handler => handler(d));
}

document.addEventListener('keydown', (e) => {
  if (timePassage && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); finishTimePassage(); return; }
  if (typingLine && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); finishTyping(); }
});

document.addEventListener('change', (e) => {
  const d = e.target && e.target.dataset;
  if (!d || !state.report) return;
  if (d.reportSpecial) toggleReport('special', d.reportSpecial, e.target.checked);
  else if (d.reportHandoff) toggleReport('handoff', d.reportHandoff, e.target.checked);
});

$('btn-manual').onclick = showManual;

/* ---------- 起動 ---------- */

initializeSoundSettings();
initializeCareer();
resetGame();
showBriefing();
