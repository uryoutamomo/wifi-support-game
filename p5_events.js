/* ============================================================
   イベント
   ============================================================ */

document.addEventListener('click', (e) => {
  if (typingLine){ finishTyping(); return; }
  const el = e.target.closest('[data-office-answer],[data-office-callback],[data-callback-destination],[data-command],[data-greet],[data-hangup],[data-hangup-confirm],[data-hangup-cancel],[data-ask-group],[data-ask],[data-smalltalk],[data-tell],[data-refund],[data-refund-confirm],[data-refund-cancel],[data-soothe],[data-apology],[data-lookup],[data-lookup-mode],[data-lookup-back],[data-test],[data-cause],[data-remedy],[data-ship-level],[data-ship-confirm],[data-report-submit],[data-tone],[data-board-excluded]');
  if (!el || el.disabled) return;
  playCommandSound();
  routeAction(el.dataset);
});

function firstTicketIn(stateName, orderKey){
  return state.tickets
    .filter(ticket => ticket.state === stateName)
    .sort((a, b) => a[orderKey] - b[orderKey])[0];
}

function handleDisplayAction(d){
  if (d.boardExcluded){ state.ui.boardExcludedOpen = !state.ui.boardExcludedOpen; renderBoard(); return true; }
  return false;
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
  return false;
}

function handleCallNavigation(d){
  if (d.callbackDestination){ startCarrierCallback(d.callbackDestination); return true; }
  if (d.hangup){
    const t = state.focus;
    if (!t) return true;
    if (t.pendingResult) finishResolvedCall(t);
    else if (t.pendingInterruption) finishInterruptedCall(t);
    else { state.ui = defaultUi('hangup_confirm'); render(); }
    return true;
  }
  if (d.hangupConfirm){ interruptCall(state.focus); return true; }
  if (d.hangupCancel){ state.ui = defaultUi(); render(); return true; }
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
  if (d.refund){ state.ui = defaultUi('refund_confirm'); render(); return true; }
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
  if (d.tone){ doClose(state.ui.cause, state.ui.remedy, d.tone); return true; }
  return false;
}

function routeAction(d){
  [handleDisplayAction, handleOfficeAction, handleCallNavigation, handleConversationAction, handleResolutionAction]
    .some(handler => handler(d));
}

document.addEventListener('keydown', (e) => {
  if (typingLine && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); finishTyping(); }
});

document.addEventListener('change', (e) => {
  const d = e.target && e.target.dataset;
  if (!d || !state.report) return;
  if (d.reportSpecial) toggleReport('special', d.reportSpecial, e.target.checked);
  else if (d.reportHandoff) toggleReport('handoff', d.reportHandoff, e.target.checked);
});

$('btn-manual').onclick = showManual;
$('btn-balance').onclick = showBalanceWarning;

/* ---------- 起動 ---------- */

initializeCareer();
resetGame();
showBriefing();
