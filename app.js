(function () {
  "use strict";

  var JSON_FILE_PATH = "quiz_questions.json";
  var STORAGE_KEY = "pyqs_practice_progress_v2";
  var DISPLAY_LETTERS = ["a", "b", "c", "d"];

  // ==================== STATE ====================
  var quizData = {};
  var dayNames = [];
  var savedProgress = loadProgressFromStorage();

  var activeDay = null;
  var activeSession = null;

  // ==================== DOM ELEMENTS ====================
  var menuView = document.getElementById("menu-view");
  var quizView = document.getElementById("quiz-view");
  var loadingIndicator = document.getElementById("loading-indicator");
  var daysGrid = document.getElementById("days-grid");

  var backToMenuBtn = document.getElementById("back-to-menu-btn");
  var currentDayLabel = document.getElementById("current-day-label");
  var questionCounter = document.getElementById("question-counter");
  var scoreDisplay = document.getElementById("score-display");
  var progressFill = document.getElementById("progress-fill");
  var reviewBanner = document.getElementById("review-banner");
  var questionTextEl = document.getElementById("question-text");
  var optionsContainer = document.getElementById("options-container");
  var prevBtn = document.getElementById("prev-btn");
  var nextBtn = document.getElementById("next-btn");

  var actionModal = document.getElementById("action-modal");
  var modalTitle = document.getElementById("modal-title");
  var modalMessage = document.getElementById("modal-message");
  var modalActions = document.getElementById("modal-actions");
  var modalCancelBtn = document.getElementById("modal-cancel-btn");

  // ==================== LOCAL STORAGE HELPERS ====================
  function loadProgressFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error("Failed to read from localStorage:", err);
      return {};
    }
  }

  function saveProgressToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProgress));
    } catch (err) {
      console.error("Failed to write to localStorage:", err);
    }
  }

  // ==================== SHUFFLE ENGINE ====================
  function fisherYatesShuffle(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  /**
   * Creates a lightweight session for a Day.
   * Only stores the shuffled key order (e.g. ["c","a","d","b"]) and selected index (null or 0..3).
   * Question text, option text, and answer_key are ALWAYS read fresh from quiz_questions.json.
   */
  function createFreshDaySession(dayName) {
    var rawQuestions = quizData[dayName] || [];
    var orders = [];
    var answers = [];

    for (var i = 0; i < rawQuestions.length; i++) {
      var origKeys = Object.keys(rawQuestions[i].options);
      orders.push(fisherYatesShuffle(origKeys));
      answers.push(null);
    }

    return {
      currentIndex: 0,
      completed: false,
      reviewMode: false,
      orders: orders,
      answers: answers
    };
  }

  function isSessionValid(dayName, session) {
    var rawQuestions = quizData[dayName];
    if (!rawQuestions || !session) {
      return false;
    }
    return (
      Array.isArray(session.orders) &&
      Array.isArray(session.answers) &&
      session.orders.length === rawQuestions.length &&
      session.answers.length === rawQuestions.length
    );
  }

  // ==================== SCORE & STATS HELPERS ====================
  function getDayStats(dayName, session) {
    var rawQuestions = quizData[dayName] || [];
    var total = rawQuestions.length;
    var answered = 0;
    var right = 0;
    var wrong = 0;

    for (var i = 0; i < total; i++) {
      var selectedIdx = session.answers[i];
      if (selectedIdx !== null && selectedIdx !== undefined) {
        answered += 1;
        var shuffledKeys = session.orders[i];
        var chosenOrigKey = shuffledKeys[selectedIdx];
        var correctKey = String(rawQuestions[i].answer_key || "").toLowerCase().trim();

        if (String(chosenOrigKey || "").toLowerCase().trim() === correctKey) {
          right += 1;
        } else {
          wrong += 1;
        }
      }
    }

    return {
      total: total,
      answered: answered,
      right: right,
      wrong: wrong
    };
  }

  function getNextDayName(currentDay) {
    var idx = dayNames.indexOf(currentDay);
    if (idx !== -1 && idx + 1 < dayNames.length) {
      return dayNames[idx + 1];
    }
    return null;
  }

  // ==================== INITIALIZATION ====================
  function init() {
    bindEvents();

    fetch(JSON_FILE_PATH)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status + " while loading " + JSON_FILE_PATH);
        }
        return response.json();
      })
      .then(function (data) {
        quizData = data;
        dayNames = Object.keys(quizData);
        loadingIndicator.classList.add("hidden");
        renderMenuGrid();
      })
      .catch(function (error) {
        console.error(error);
        loadingIndicator.textContent =
          "Could not load quiz_questions.json. Make sure it is in the same folder and opened via GitHub Pages or a local server.";
      });
  }

  // ==================== MAIN MENU RENDERING ====================
  function renderMenuGrid() {
    daysGrid.innerHTML = "";

    dayNames.forEach(function (dayName, idx) {
      var totalQuestions = quizData[dayName].length;
      var session = savedProgress[dayName];

      var statusText = "Not Started";
      var statusClass = "";

      if (isSessionValid(dayName, session)) {
        var stats = getDayStats(dayName, session);
        if (session.completed || stats.answered === totalQuestions) {
          statusText = "Completed (" + stats.right + "/" + totalQuestions + ")";
          statusClass = "completed";
        } else if (stats.answered > 0) {
          statusText = "In Progress (" + stats.answered + "/" + totalQuestions + ")";
          statusClass = "in-progress";
        }
      }

      // Unique sparkling border colors per Day card
      var baseHue = (idx * 137.508) % 360;
      var hue2 = (baseHue + 65) % 360;
      var hue3 = (baseHue + 140) % 360;

      var card = document.createElement("button");
      card.type = "button";
      card.className = "day-card";
      card.style.setProperty("--hue-1", baseHue.toFixed(1) + "deg");
      card.style.setProperty("--hue-2", hue2.toFixed(1) + "deg");
      card.style.setProperty("--hue-3", hue3.toFixed(1) + "deg");
      card.style.animationDelay = -(idx * 0.45) + "s";

      card.innerHTML =
        "<div>" +
        '<div class="day-card-title">' + escapeHtml(dayName) + "</div>" +
        '<div class="day-card-count">' + totalQuestions + " Questions</div>" +
        "</div>" +
        '<span class="day-card-status ' + statusClass + '">' + escapeHtml(statusText) + "</span>";

      card.addEventListener("click", function () {
        handleDaySelection(dayName);
      });

      daysGrid.appendChild(card);
    });
  }

  // ==================== DAY CLICK & DIALOG LOGIC ====================
  function handleDaySelection(dayName) {
    var existing = savedProgress[dayName];

    if (!isSessionValid(dayName, existing)) {
      startNewAttempt(dayName);
      return;
    }

    var stats = getDayStats(dayName, existing);

    if (existing.completed || stats.answered === stats.total) {
      openActionModal({
        title: dayName + " Completed",
        message:
          "Right: " + stats.right + "   |   Wrong: " + stats.wrong +
          "\nTotal Questions: " + stats.total + "\n\nWhat would you like to do?",
        buttons: [
          {
            label: "Review Answers",
            className: "btn btn-primary",
            onClick: function () {
              existing.completed = true;
              existing.reviewMode = true;
              existing.currentIndex = 0;
              saveProgressToStorage();
              openQuizView(dayName, existing);
            }
          },
          {
            label: "Restart Quiz (Shuffle Options)",
            className: "btn btn-danger",
            onClick: function () {
              startNewAttempt(dayName);
            }
          }
        ]
      });
    } else if (stats.answered > 0) {
      openActionModal({
        title: dayName,
        message:
          "You answered " + stats.answered + " of " + stats.total +
          " questions.\nResume where you left off or restart?",
        buttons: [
          {
            label: "Resume Quiz",
            className: "btn btn-primary",
            onClick: function () {
              existing.reviewMode = false;
              saveProgressToStorage();
              openQuizView(dayName, existing);
            }
          },
          {
            label: "Restart Quiz (Shuffle Options)",
            className: "btn btn-danger",
            onClick: function () {
              startNewAttempt(dayName);
            }
          }
        ]
      });
    } else {
      startNewAttempt(dayName);
    }
  }

  function startNewAttempt(dayName) {
    var freshSession = createFreshDaySession(dayName);
    savedProgress[dayName] = freshSession;
    saveProgressToStorage();
    openQuizView(dayName, freshSession);
  }

  function openActionModal(config) {
    modalTitle.textContent = config.title;
    modalMessage.textContent = config.message;
    modalActions.innerHTML = "";

    config.buttons.forEach(function (btnConfig) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = btnConfig.className;
      btn.textContent = btnConfig.label;
      btn.addEventListener("click", function () {
        closeActionModal();
        btnConfig.onClick();
      });
      modalActions.appendChild(btn);
    });

    actionModal.classList.remove("hidden");
  }

  function closeActionModal() {
    actionModal.classList.add("hidden");
  }

  // ==================== QUIZ VIEW & QUESTION RENDERING ====================
  function openQuizView(dayName, session) {
    activeDay = dayName;
    activeSession = session;

    menuView.classList.add("hidden");
    quizView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });

    renderCurrentQuestion();
  }

  function returnToMenu() {
    activeDay = null;
    activeSession = null;

    quizView.classList.add("hidden");
    menuView.classList.remove("hidden");
    renderMenuGrid();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCurrentQuestion() {
    if (!activeSession || !activeDay) {
      return;
    }

    var rawQuestions = quizData[activeDay];
    var total = rawQuestions.length;
    var idx = Math.max(0, Math.min(activeSession.currentIndex, total - 1));
    activeSession.currentIndex = idx;

    var rawQ = rawQuestions[idx];
    var shuffledKeys = activeSession.orders[idx];
    var selectedIdx = activeSession.answers[idx];
    var isAnswered = selectedIdx !== null && selectedIdx !== undefined;
    var correctKey = String(rawQ.answer_key || "").toLowerCase().trim();

    var stats = getDayStats(activeDay, activeSession);

    // Header & Progress Bar
    currentDayLabel.textContent = activeDay;
    questionCounter.textContent = (idx + 1) + " / " + total;
    scoreDisplay.textContent = "Score: " + stats.right;

    var progressPercent = total > 0 ? (stats.answered / total) * 100 : 0;
    progressFill.style.width = progressPercent + "%";

    if (activeSession.reviewMode) {
      reviewBanner.classList.remove("hidden");
    } else {
      reviewBanner.classList.add("hidden");
    }

    // Question text
    questionTextEl.textContent = "Q" + (idx + 1) + ". " + rawQ.question;

    // Render Shuffled Options
    optionsContainer.innerHTML = "";
    shuffledKeys.forEach(function (origKey, optIdx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";

      var isThisCorrect = String(origKey).toLowerCase().trim() === correctKey;

      if (isAnswered || activeSession.reviewMode) {
        btn.disabled = true;

        if (isThisCorrect) {
          btn.classList.add("correct");
        } else if (selectedIdx === optIdx && !isThisCorrect) {
          btn.classList.add("wrong");
        }
      }

      var letterSpan = document.createElement("span");
      letterSpan.className = "option-letter";
      letterSpan.textContent = DISPLAY_LETTERS[optIdx] || String.fromCharCode(97 + optIdx);

      var textSpan = document.createElement("span");
      textSpan.className = "option-label-text";
      textSpan.textContent = rawQ.options[origKey];

      btn.appendChild(letterSpan);
      btn.appendChild(textSpan);

      if (!isAnswered && !activeSession.reviewMode) {
        btn.addEventListener("click", function () {
          handleOptionSelect(optIdx);
        });
      }

      optionsContainer.appendChild(btn);
    });

    // Previous Button
    prevBtn.disabled = idx === 0;

    // Next Button: strictly locked until current question is answered (no skipping)
    nextBtn.disabled = !isAnswered;

    var nextDay = getNextDayName(activeDay);
    if (idx === total - 1) {
      if (activeSession.reviewMode) {
        nextBtn.textContent = nextDay ? "Next Quiz \u2192" : "Finish Review";
      } else {
        nextBtn.textContent = nextDay ? "Next Quiz \u2192" : "Finish Quiz";
      }
    } else {
      nextBtn.textContent = "Next \u2192";
    }

    saveProgressToStorage();
  }

  function handleOptionSelect(selectedOptionIndex) {
    if (!activeSession || !activeDay) {
      return;
    }

    var idx = activeSession.currentIndex;
    if (activeSession.answers[idx] !== null && activeSession.answers[idx] !== undefined) {
      return;
    }

    activeSession.answers[idx] = selectedOptionIndex;

    var stats = getDayStats(activeDay, activeSession);
    if (stats.answered === stats.total) {
      activeSession.completed = true;
    }

    saveProgressToStorage();
    renderCurrentQuestion();
  }

  function handlePrevClick() {
    if (!activeSession || activeSession.currentIndex <= 0) {
      return;
    }
    activeSession.currentIndex -= 1;
    renderCurrentQuestion();
  }

  function handleNextClick() {
    if (!activeSession || !activeDay) {
      return;
    }

    var total = quizData[activeDay].length;
    var idx = activeSession.currentIndex;

    // Strictly block skipping unanswered questions
    if (activeSession.answers[idx] === null || activeSession.answers[idx] === undefined) {
      return;
    }

    if (idx < total - 1) {
      activeSession.currentIndex += 1;
      renderCurrentQuestion();
    } else {
      // Completed the final question -> show Right & Wrong summary + Next Quiz option
      activeSession.completed = true;
      saveProgressToStorage();

      var stats = getDayStats(activeDay, activeSession);
      var nextDay = getNextDayName(activeDay);
      var modalButtons = [];

      if (nextDay) {
        modalButtons.push({
          label: "Next Quiz (" + nextDay + ")",
          className: "btn btn-primary",
          onClick: function () {
            handleDaySelection(nextDay);
          }
        });
      }

      modalButtons.push({
        label: "Review Answers",
        className: nextDay ? "btn btn-secondary" : "btn btn-primary",
        onClick: function () {
          activeSession.reviewMode = true;
          activeSession.currentIndex = 0;
          saveProgressToStorage();
          renderCurrentQuestion();
        }
      });

      modalButtons.push({
        label: "Back to Main Menu",
        className: "btn btn-secondary",
        onClick: function () {
          returnToMenu();
        }
      });

      openActionModal({
        title: activeDay + " Completed!",
        message:
          "Right Answers: " + stats.right +
          "\nWrong Answers: " + stats.wrong +
          "\nTotal Questions: " + stats.total,
        buttons: modalButtons
      });
    }
  }

  // ==================== UTILITY HELPERS ====================
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    backToMenuBtn.addEventListener("click", returnToMenu);
    prevBtn.addEventListener("click", handlePrevClick);
    nextBtn.addEventListener("click", handleNextClick);

    modalCancelBtn.addEventListener("click", closeActionModal);
    actionModal.addEventListener("click", function (e) {
      if (e.target === actionModal) {
        closeActionModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !actionModal.classList.contains("hidden")) {
        closeActionModal();
      }
    });
  }

  // Start application
  init();
})();