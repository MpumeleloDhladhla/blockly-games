/**
 * Teacher settings page. Talks to ThinkaConfig (src/thinka.config.js).
 * No server. The password never leaves this browser.
 */
'use strict';

(function() {
  var gate = document.getElementById('teacherGate');
  var settings = document.getElementById('teacherSettings');
  var status = document.getElementById('teacherPasswordStatus');
  var detail = document.getElementById('teacherPasswordDetail');
  var setHeading = document.getElementById('setHeading');
  var setCopy = document.getElementById('setCopy');
  var removeButton = document.getElementById('removePassword');
  var removeHint = document.getElementById('removeHint');

  function passwordOn() {
    return !!(window.ThinkaConfig && ThinkaConfig.isTeacherPasswordOn());
  }

  function paint() {
    var on = passwordOn();
    status.textContent = on ? 'Password is ON' : 'Password is OFF';
    status.className = 'teacher-status ' + (on ? 'is-on' : 'is-off');
    detail.textContent = on ?
        'Students need this password to open a locked level.' :
        'Locked levels open with no password prompt.';
    setHeading.textContent = on ? 'Change the password' : 'Set a password';
    setCopy.textContent = on ?
        'Type a new password twice. The old one stops working on this computer.' :
        'Type a password twice to turn the lock back on.';
    removeButton.hidden = !on;
    removeHint.hidden = !on;
  }

  function showSettings() {
    gate.hidden = true;
    settings.hidden = false;
    paint();
    var field = document.getElementById('newPassword');
    if (field) {
      field.focus();
    }
  }

  function showGate() {
    settings.hidden = true;
    gate.hidden = false;
    paint();
    var field = document.getElementById('currentPassword');
    if (field) {
      field.focus();
    }
  }

  document.getElementById('gateForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var input = document.getElementById('currentPassword');
    var error = document.getElementById('gateError');
    if (ThinkaConfig.checkTeacherPassword(input.value)) {
      error.textContent = '';
      input.value = '';
      showSettings();
      return;
    }
    error.textContent = 'That password is not correct. Try again.';
    input.value = '';
    input.focus();
  });

  document.getElementById('setForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var first = document.getElementById('newPassword');
    var second = document.getElementById('confirmPassword');
    var error = document.getElementById('setError');
    var note = document.getElementById('setNote');
    var next = String(first.value || '').trim();
    var again = String(second.value || '').trim();
    note.textContent = '';
    if (!next || !again) {
      error.textContent = 'Type the new password in both boxes.';
      first.focus();
      return;
    }
    if (next !== again) {
      error.textContent = 'Those passwords do not match.';
      second.focus();
      return;
    }
    var button = document.getElementById('savePassword');
    button.disabled = true;
    error.textContent = '';
    ThinkaConfig.setTeacherPassword(next, function(ok) {
      button.disabled = false;
      if (!ok) {
        error.textContent = 'Could not save the password in this browser.';
        return;
      }
      first.value = '';
      second.value = '';
      note.textContent = 'Saved. The new password is on for this browser.';
      paint();
    });
  });

  document.getElementById('resetDefault').addEventListener('click', function() {
    var ok = window.confirm(
        'Reset the teacher password on this computer to thinka?');
    if (!ok) {
      return;
    }
    var note = document.getElementById('setNote');
    var error = document.getElementById('setError');
    if (!ThinkaConfig.resetTeacherPassword()) {
      error.textContent = 'Could not reset the password in this browser.';
      return;
    }
    error.textContent = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    note.textContent = 'Reset. The teacher password on this computer is thinka again.';
    paint();
  });

  removeButton.addEventListener('click', function() {
    var ok = window.confirm(
        'Remove the classroom password? Locked levels will open with no password.');
    if (!ok) {
      return;
    }
    var note = document.getElementById('setNote');
    var error = document.getElementById('setError');
    if (!ThinkaConfig.removeTeacherPassword()) {
      error.textContent = 'Could not remove the password in this browser.';
      return;
    }
    error.textContent = '';
    note.textContent = 'Removed. Locked levels open with no password prompt.';
    paint();
  });

  document.getElementById('resetProgress').addEventListener('click', function() {
    var ok = window.confirm(
        'Delete all student progress on this computer? Solutions, stars, scores, and level unlocks will be cleared. The teacher password stays.');
    if (!ok) {
      return;
    }
    var note = document.getElementById('resetNote');
    if (!ThinkaConfig.clearStudentProgress()) {
      note.textContent = 'Could not clear progress in this browser.';
      return;
    }
    note.textContent = 'Student progress on this computer has been cleared. The password setting is unchanged.';
  });

  if (passwordOn()) {
    showGate();
  } else {
    showSettings();
  }
})();
