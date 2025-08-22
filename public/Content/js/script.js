// ============== CALENDAR CONSTANTS ============== //
const projectColorMap = new Map();
const colorPalette = [
    '#002244', // Cowboys Navy
    '#003366', // Darker Blue Accent
    '#005A9C', // Royal Blue Accent
    '#1D2951', // Midnight Blue
    '#A5ACAF', // Silver
    '#B0B7BC', // Lighter Silver
    '#C8D2DC', // Pale Steel Gray
    '#E1E4E8', // Light Gray Highlight
    '#8395A7', // Muted Blue-Gray
    '#6E7B8B', // Slate Gray
    '#879BA6', // Soft Blue-Silver
    '#D0D7DD'  // Faint Blue Tint
];

let currentDate = new Date();
let entryDayMap = new Map();
let ptoMap = new Map();
let holidayMap = new Map();
let rangeStartDate = null;

// ============== WINDOW CONSTANTS ============== //
let isSelectingWeek = false;
let frozenWeek = false;
let submittedWeeks = [];
let isMobile = window.innerWidth <= 768;

window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);

    const newIsMobile = window.innerWidth <= 768;

    if (newIsMobile !== isMobile) {
        isMobile = newIsMobile;

        populateHoursDropdown();
        queryProjects();
        queryEntries();
    }
});
function getEl(idBase) {
    return document.getElementById(`${idBase}-${isMobile ? 'mobile' : 'desktop'}`);
}

// ============== MOBILE CONSTANTS ============== //
let swipeCooldown = false;
let touchStartX = null;
let currentSwipeDirection = null;

const glowLeft = document.getElementById('swipe-glow-left');
const glowRight = document.getElementById('swipe-glow-right');
const calendarMobile = document.getElementById('calendar-mobile');

const toggleBtn = document.getElementById('toggle-entry-btn');
const entrySection = document.querySelector('.entry-section');
const caret = document.getElementById('entry-caret');

// ============== PAYDAY CONSTANTS ============== //
const PAYDAY_INTERVAL = 14; // every 2 weeks
const PAYDAY_ANCHOR = new Date(2025, 0, 3); // Jan 3, 2025
const PTO_RATE = 80 / 365; // 2 weeks per year

const paydaySet = new Set();
const deadlineSet = new Set();

// ============== CALENDAR FUNCTIONS ============== //
function generateCalendar() {
    const calendar = getEl('calendar');

    if (!calendar) return;

    calendar.innerHTML = '';

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const monthNames = [
        'January', 'February', 'March', 'April',
        'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'
    ];

    calculatePayPeriods(year, month);
    populateHolidayMap(year);

    let html = `
        <div id="week-select-message" class="week-select-message">Click any day to select a week for export. Press ESC to cancel.</div>
        <div class="month-navigation">
            <button id="prev-month" class="nav-arrow left">&lt;</button>
            <h2 class="month-header">${monthNames[month]} ${year}</h2>
            <button id="next-month" class="nav-arrow right">&gt;</button>
        </div>
    `;

    html += '<table><thead><tr class="month-header">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        html += `<th>${day}</th>`;
    });

    if (isSelectingWeek) {
        const weekStart = new Date(year, month, 1 - firstDay);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        html += `</tr></thead><tr class="month-days week-highlight" data-week="${weekStartStr}_to_${weekEndStr}">`;
    } else {
        html += '</tr></thead><tr class="month-days">';
    }

    let dayCount = 0;

    if (firstDay > 0) {
        for (let i = 0; i < firstDay; i++) {
            const prevMonthDate = new Date(year, month, -firstDay + i + 1);
            const dayNum = prevMonthDate.getDate();
            const dateStr = prevMonthDate.toISOString().split('T')[0];

            let cellHtml = `<td class="outside-month" data-date="${dateStr}"><div class="day-number">${dayNum}</div>`;

            if (entryDayMap.has(dateStr)) {
                entryDayMap.get(dateStr).forEach(entry => {
                    const projectColor = projectColorMap.get(entry.Description) || '#ccc';
                    const hours = entry.Hours || 0;
                    cellHtml += `<div class="calendar-bar" style="background-color: ${projectColor}" data-fulltext="${entry.Description}">${hours}h - ${entry.Description}</div>`;
                });
            }

            cellHtml += '</td>';
            html += cellHtml;
            dayCount++;
        }
    }

    let date = 1;
    while (date <= daysInMonth) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

        let tdClass = '';
        let holidayHtml = '';
        if (isPtoDay(dateStr)) tdClass += ' pto-day';
        if (!isSelectingWeek) tdClass += ' calendar-day';

        const holidayName = holidayMap.get(dateStr);
        if (holidayName) {
            tdClass += ' holiday-day';  // add class for styling
            holidayHtml = '<div class="pto-hours">8h</div>';
        }

        if (isWeekSubmitted(dateStr)) {
            tdClass += ' submitted-week';
        }

        let cellHtml = `<td class="${tdClass.trim()}" data-date="${dateStr}"`;
        cellHtml += dateStr === todayStr ? ' id="today">' : '>';
        cellHtml += `<div class="week-outline-container">`;

        let ptoHtml = '';
        if (ptoMap.has(dateStr)) {
            const { accrued, submitted } = ptoMap.get(dateStr);
            const adjustedAccrued = (accrued - submitted).toFixed(2);
            const submittedText = submitted > 0 ? `<div class="pto-hours">${submitted}h</div>` : '';
            ptoHtml = `${submittedText}<div class="pto-top">PTO: ${adjustedAccrued}h</div>`;
        }

        cellHtml += `${holidayHtml}${ptoHtml}<div class="day-number">${date}</div>`;

        if (entryDayMap.has(dateStr)) {
            entryDayMap.get(dateStr).forEach(entry => {
                const projectColor = projectColorMap.get(entry.Description) || '#ccc';
                const hours = entry.Hours || 0;
                cellHtml += `<div class="calendar-bar" style="background-color: ${projectColor}" data-fulltext="${entry.Description}">${hours}h - ${entry.Description}</div>`;
            });
        }

        if (paydaySet.has(dateStr)) {
            cellHtml += `<div class="calendar-icon payday" title="Payday - Click to review past 2 weeks">$</div>`;
        }

        if (deadlineSet.has(dateStr)) {
            cellHtml += `<div class="calendar-icon deadline" title="Last day to submit time">⏰</div>`;
        }

        cellHtml += '</div></td>';
        html += cellHtml;
        dayCount++;

        if (dayCount % 7 === 0) {
            const currentDate = new Date(year, month, date + 1);
            const dayOfWeek = currentDate.getDay();
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - dayOfWeek);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const weekStartStr = weekStart.toISOString().split('T')[0];
            const weekEndStr = weekEnd.toISOString().split('T')[0];

            // 🔹 Check if this week is already submitted
            const isSubmitted = submittedWeeks.some(w =>
                w.WeekStart === weekStartStr && w.WeekEnd === weekEndStr
            );

            // 🔹 Build the class string
            let rowClass = 'month-days';
            if (isSelectingWeek) rowClass += ' week-highlight';
            if (isSubmitted) rowClass += ' submitted-week';

            html += `</tr><tr class="${rowClass}" data-week="${weekStartStr}_to_${weekEndStr}">`;
        }

        date++;
    }

    const finalDate = new Date(year, month + 1, 1);
    while (dayCount % 7 !== 0) {
        const overflowDateStr = finalDate.toISOString().split('T')[0];
        const displayDay = finalDate.getDate();

        let cellHtml = `<td class="outside-month" data-date="${overflowDateStr}"><div class="week-outline-container">`;

        // Day number
        cellHtml += `<div class="day-number">${displayDay}</div>`;

        // PTO & Project entries
        if (entryDayMap.has(overflowDateStr)) {
            entryDayMap.get(overflowDateStr).forEach(entry => {
                const projectColor = projectColorMap.get(entry.Description) || '#ccc';
                const hours = entry.Hours || 0;
                cellHtml += `<div class="calendar-bar" style="background-color: ${projectColor}" data-fulltext="${entry.Description}">${hours}h - ${entry.Description}</div>`;
            });
        }

        if (paydaySet.has(overflowDateStr)) {
            cellHtml += `<div class="calendar-icon payday" title="Payday - Click to review past 2 weeks">$</div>`;
        }

        if (deadlineSet.has(overflowDateStr)) {
            cellHtml += `<div class="calendar-icon deadline" title="Last day to submit time">⏰</div>`;
        }

        cellHtml += `</div></td>`;
        html += cellHtml;

        finalDate.setDate(finalDate.getDate() + 1);
        dayCount++;
    }

    html += '</tr></tbody></table>';

    html += `
    <div class="calendar-legend">
        <div class="legend-row"><div class="legend-box holiday-example"></div>Holiday</div>
        <div class="legend-row"><div class="legend-box pto-example"></div>PTO</div>
        <div class="legend-row"><div class="legend-box outline-example"></div>Pay Period</div>
        <div class="legend-row"><div class="legend-icon">⏰</div>Last Day to Submit</div>
        <div class="legend-row"><div class="legend-icon">$</div>Payday</div>
    </div>
    `;

    if (isMobile) {
        html += `
        <div id="month-popup" class="month-popup hidden">
            ${[...Array(12).keys()].map(i => {
            const month = new Date(0, i).toLocaleString('default', { month: 'long' });
            return `<div class="month-option" data-month="${i}">${month}</div>`;
        }).join('')}
        </div>
    `;
    }

    calendar.innerHTML = html;

    const weekMessage = document.getElementById('week-select-message');
    if (!weekMessage) return;

    const todayIso = new Date().toISOString().split('T')[0];
    let matchedPayday = null;

    // Find next payday after today
    for (const paydayStr of paydaySet) {
        const payday = new Date(paydayStr);
        const today = new Date();
        if (payday >= today) {
            matchedPayday = payday;
            break;
        }
    }

    if (matchedPayday) {
        const deadline = new Date(matchedPayday);
        deadline.setDate(deadline.getDate() - 3); // Tuesday before payday

        const isTodayDeadline = todayIso === deadline.toISOString().split('T')[0];

        const weekEnd = new Date(matchedPayday);
        weekEnd.setDate(weekEnd.getDate() - 6); // End of pay period

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 13); // Beginning of pay period

        const startStr = weekStart.toISOString().split('T')[0];
        const endStr = weekEnd.toISOString().split('T')[0];

        if (isTodayDeadline) {
            weekMessage.innerHTML = `<span style="color: crimson; font-weight: bold;">Today is the last day to submit for ${startStr} to ${endStr}</span>`;
        } else {
            weekMessage.textContent = `Current pay period: ${startStr} to ${endStr}`;
        }

        weekMessage.classList.add('visible');
    }

    let lastTap = 0;
    document.querySelectorAll('.calendar-day').forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (!isMobile) return;

            const now = new Date().getTime();
            const delta = now - lastTap;
            lastTap = now;

            if (delta < 400) {
                const dateStr = cell.getAttribute('data-date');
                if (dateStr) openEntryPopup(dateStr);
            }
        });
    });
    document.querySelectorAll('.calendar-icon.payday').forEach(icon => {
        icon.addEventListener('mouseenter', () => {
            if (frozenWeek) return;
            const cell = icon.closest('td');
            if (!cell) return;
            const dateStr = cell.getAttribute('data-date');
            highlightPreviousTwoWeeks(dateStr);
        });

        icon.addEventListener('mouseleave', () => {
            if (!frozenWeek) clearHighlightedWeek();
        });

        icon.addEventListener('click', () => {
            const cell = icon.closest('td');
            if (!cell) return;
            const dateStr = cell.getAttribute('data-date');
            highlightPreviousTwoWeeks(dateStr);
            frozenWeek = true;
        });
    });

    if (isSelectingWeek) {
        document.querySelectorAll('tr[data-week]').forEach(row => {
            row.addEventListener('mouseenter', () => row.classList.add('week-highlight-hover'));
            row.addEventListener('mouseleave', () => row.classList.remove('week-highlight-hover'));
            row.addEventListener('click', () => {
                const range = row.getAttribute('data-week');
                if (!range || !range.includes('_to_')) return;

                const [startStr, endStr] = range.split('_to_');
                const userId = sessionStorage.getItem('username');

                // 🔁 Calculate the payday for that week (Friday)
                const weekStart = new Date(startStr);
                const weekEndDate = new Date(endStr);

                // Find the first payday after or equal to week end
                let realPayday;
                for (const p of paydaySet) {
                    const paydayDate = new Date(p);
                    if (paydayDate >= weekEndDate) {
                        realPayday = paydayDate;
                        break;
                    }
                }

                if (!realPayday) {
                    alert('Could not determine payday for this week.');
                    return;
                }

                const deadline = new Date(realPayday);
                deadline.setDate(deadline.getDate() - 3); // Tuesday before payday

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (today > deadline) {
                    const role = sessionStorage.getItem('role');
                    if (role !== 'admin') {
                        alert('You can no longer submit this week. The submission deadline has passed.');
                        return;
                    }
                }

                // 🛑 Confirmation before final submit
                const confirmSubmit = confirm(
                    'Once you submit this week, you will no longer be able to make changes. Do you wish to continue?'
                );

                if (!confirmSubmit) {
                    return; // user canceled
                }

                handleWeekSubmit(userId, startStr, endStr);
            });
        });
    }

    attachMonthSwitchHandlers();
    attachCalendarDayListeners();

    if (isMobile) {
        const monthHeader = document.querySelector('.month-header');
        const popup = document.getElementById('month-popup');

        if (monthHeader && popup) {
            monthHeader.addEventListener('click', () => {
                popup.classList.toggle('hidden');
            });

            popup.querySelectorAll('.month-option').forEach(option => {
                option.addEventListener('click', () => {
                    const selectedMonth = parseInt(option.getAttribute('data-month'));
                    currentDate.setMonth(selectedMonth);
                    popup.classList.add('hidden');
                    queryEntries();
                });
            });
        }

        updateGlowHeightToTable();
        enableSwipeNavigation(calendar);
    }
}
function calculatePayPeriods(viewYear, viewMonth) {
    paydaySet.clear();
    deadlineSet.clear();

    // Find the first Friday in 2025 that aligns with the July 18 payday cycle
    let payday = new Date(2025, 0, 1); // Jan 1, 2025
    while (payday.getDay() !== 5) { // find first Friday
        payday.setDate(payday.getDate() + 1);
    }

    // Step through every 14 days until we hit or pass the anchor
    while (payday < PAYDAY_ANCHOR) {
        payday.setDate(payday.getDate() + PAYDAY_INTERVAL);
    }

    // Step back in 14-day intervals until before Jan 1, 2025
    while (payday.getFullYear() === 2025 && payday > new Date(2025, 0, 1)) {
        const test = new Date(payday);
        test.setDate(test.getDate() - PAYDAY_INTERVAL);
        if (test >= new Date(2025, 0, 1)) payday = test;
        else break;
    }

    // Now payday is the first valid one in 2025 — generate forward
    const endOfMonth = new Date(viewYear, viewMonth + 2, 0);
    while (payday <= endOfMonth) {
        const paydayStr = payday.toISOString().split('T')[0];
        paydaySet.add(paydayStr);

        const deadline = new Date(payday);
        deadline.setDate(payday.getDate() - 3); // Tuesday of that week
        const deadlineStr = deadline.toISOString().split('T')[0];
        deadlineSet.add(deadlineStr);

        payday.setDate(payday.getDate() + PAYDAY_INTERVAL);
    }
}
function goToNextMonth() {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    currentDate = newDate;
    queryEntries();
}
function goToPreviousMonth() {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    currentDate = newDate;
    queryEntries();
}
function populateHoursDropdown() {
    const hoursDropdowns = getEl('hours');
    hoursDropdowns.innerHTML = '';
    for (let i = 1; i <= 12; i += 0.5) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        hoursDropdowns.appendChild(opt);
    }
}
function parseEntryRange(entry) {
    const start = new Date(entry.StartDate);
    const end = new Date(entry.EndDate);
    return { start, end };
}
function buildEntryDayMap(entries) {
    entryDayMap.clear();
    entries.forEach(entry => {
        const { start, end } = parseEntryRange(entry);
        const current = new Date(start);
        while (current <= end) {
            const key = current.toISOString().split('T')[0];
            if (!entryDayMap.has(key)) entryDayMap.set(key, []);
            entryDayMap.get(key).push(entry);
            current.setDate(current.getDate() + 1);
        }
    });
}
function attachMonthSwitchHandlers() {
    document.getElementById('prev-month').addEventListener('click', goToPreviousMonth);
    document.getElementById('next-month').addEventListener('click', goToNextMonth);
}
function attachCalendarDayListeners() {
    document.querySelectorAll('.calendar-day').forEach(cell => {
        cell.addEventListener('click', (e) => {
            const selectedDateStr = cell.getAttribute('data-date');
            if (!selectedDateStr) return;

            if (isSelectingWeek) {
                const parentRow = cell.closest('tr.week-highlight');
                if (parentRow) parentRow.style.visibility = 'visible';

                const clickedDate = new Date(selectedDateStr);
                const startOfWeek = new Date(clickedDate);
                startOfWeek.setDate(clickedDate.getDate() - clickedDate.getDay());

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);

                exportWeekToExcel(startOfWeek, endOfWeek);

                isSelectingWeek = false;
                getEl('week-select-message')?.classList.remove('visible');
                return;
            }

            const clickedDate = new Date(selectedDateStr);

            if (e.shiftKey && rangeStartDate) {
                // Shift+click: highlight range
                const [start, end] = rangeStartDate <= clickedDate
                    ? [rangeStartDate, clickedDate]
                    : [clickedDate, rangeStartDate];

                document.querySelectorAll('.calendar-day.selected').forEach(el =>
                    el.classList.remove('selected')
                );

                const temp = new Date(start);
                while (temp <= end) {
                    const tempStr = temp.toISOString().split('T')[0];
                    const rangeCell = document.querySelector(`.calendar-day[data-date="${tempStr}"]`);
                    if (rangeCell) rangeCell.classList.add('selected');
                    temp.setDate(temp.getDate() + 1);
                }

                const entryStart = getEl('entry-start');
                const entryEnd = getEl('entry-end');
                if (entryStart && entryEnd) {
                    entryStart.value = start.toISOString().split('T')[0];
                    entryEnd.value = end.toISOString().split('T')[0];
                }

                rangeStartDate = null;
            } else {
                // Normal single-click: reset + select
                document.querySelectorAll('.calendar-day.selected').forEach(el =>
                    el.classList.remove('selected')
                );

                cell.classList.add('selected');
                rangeStartDate = clickedDate;

                const entryStart = getEl('entry-start');
                const entryEnd = getEl('entry-end');
                if (entryStart && entryEnd) {
                    entryStart.value = selectedDateStr;
                    entryEnd.value = selectedDateStr;
                }
            }
        });
    });
}
function queryProjects() {
    fetch('/Projects')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) {
                console.error('Unexpected response format:', data);
                throw new Error('Expected an array but got something else.');
            }

            const dropdown = getEl('category-list');

            dropdown.innerHTML = '';

            // Always add PTO Request first
            const ptoOption = document.createElement('option');
            ptoOption.value = 'PTO Request';
            ptoOption.textContent = 'PTO Request';
            dropdown.appendChild(ptoOption);

            data.forEach(project => {
                const option = document.createElement('option');
                option.textContent = project.Description;
                option.value = project.Description;
                dropdown.appendChild(option);

                // Assign a consistent color if not already assigned
                if (!projectColorMap.has(project.Description)) {
                    projectColorMap.set(project.Description, getColorForProject(project.Description));
                }
            });

            // Ensure PTO Request always has a consistent color
            if (!projectColorMap.has('PTO Request')) {
                projectColorMap.set('PTO Request', '#6a1b9a');
            }
        })
        .catch(error => {
            console.error('Error fetching projects:', error);
            alert('Could not load projects. See console for details.');
        });
}
function getColorForProject(description) {
    if (!projectColorMap[description]) {
        // Cycle through colors to avoid duplicates
        const index = Object.keys(projectColorMap).length % colorPalette.length;
        projectColorMap[description] = colorPalette[index];
    }
    return projectColorMap[description];
}
function queryEntries() {
    const userId = sessionStorage.getItem('username');
    fetch(`/ProjectEntries/${encodeURIComponent(userId)}`)
        .then(res => res.json())
        .then(data => {
            buildEntryDayMap(data);
            return Promise.all([
                queryPTO(userId, new Date(currentDate)),
                querySubmittedWeeks(userId)
            ]);
        })
        .then(() => {
            generateCalendar();

            const today = new Date();
            let nextPayday = null;

            for (const dateStr of paydaySet) {
                const payday = new Date(dateStr);
                if (payday >= today) {
                    nextPayday = payday;
                    break;
                }
            }

            if (nextPayday) {
                const paydayStr = nextPayday.toISOString().split('T')[0];
                frozenWeek = true;
                highlightPreviousTwoWeeks(paydayStr);
            }
        })
        .catch(error => {
            console.error('Error fetching project entries:', error);
            alert('Could not load project entries.');
        });
}
function highlightWeekFromCell(cell) {
    const clickedDate = new Date(cell.getAttribute('data-date'));
    const startOfWeek = new Date(clickedDate);
    startOfWeek.setDate(clickedDate.getDate() - clickedDate.getDay());

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const targetCell = document.querySelector(`[data-date="${key}"]`);
        if (targetCell) targetCell.classList.add('week-highlight');
    }
}
function highlightPreviousTwoWeeks(endDateStr) {
    clearHighlightedWeek();

    const calendar = getEl('calendar');
    const endDate = new Date(endDateStr);
    const saturdayBeforePayday = new Date(endDate);
    saturdayBeforePayday.setDate(endDate.getDate() - endDate.getDay() - 1); // Saturday before payday week

    const sundayTwoWeeksPrior = new Date(saturdayBeforePayday);
    sundayTwoWeeksPrior.setDate(saturdayBeforePayday.getDate() - 13); // Go back 13 days to Sunday

    const cells = [];
    let d = new Date(sundayTwoWeeksPrior);
    for (let i = 0; i < 14; i++) {
        const key = d.toISOString().split('T')[0];
        const cell = document.querySelector(`[data-date="${key}"]`);
        if (!cell) {
            return;
        }
        cells.push(cell);
        d.setDate(d.getDate() + 1);
    }

    const firstTop = cells[0].offsetTop;
    const firstLeft = Math.min(...cells.map(c => c.offsetLeft));
    const lastRight = Math.max(...cells.map(c => c.offsetLeft + c.offsetWidth));
    const height = cells[13].offsetTop - cells[0].offsetTop;

    const cellPaddingOffset = 2;
    const outline = document.createElement('div');
    outline.id = 'active-week-outline';
    outline.className = 'week-outline';
    outline.style.position = 'absolute';
    outline.style.top = `${firstTop - cellPaddingOffset}px`;
    outline.style.left = `${firstLeft - cellPaddingOffset}px`;
    outline.style.width = `${lastRight - firstLeft + cellPaddingOffset * 2}px`;
    outline.style.height = `${height + cellPaddingOffset}px`;

    calendar.appendChild(outline);
}
// ============== HOLIDAY FUNCTIONS ============== //
function populateHolidayMap(year) {
    holidayMap.clear();

    // Fixed-date holidays
    holidayMap.set(`${year}-01-01`, 'New Year\'s Day');
    holidayMap.set(`${year}-06-19`, 'Juneteenth');
    holidayMap.set(`${year}-07-04`, 'Independence Day');
    holidayMap.set(`${year}-12-24`, 'Christmas Eve');
    holidayMap.set(`${year}-12-25`, 'Christmas Day');

    // Dynamic-date holidays
    holidayMap.set(getMemorialDay(year), 'Memorial Day');
    holidayMap.set(getLaborDay(year), 'Labor Day');
    holidayMap.set(getThanksgiving(year), 'Thanksgiving Day');
    holidayMap.set(getThanksgivingFriday(year), 'Day After Thanksgiving');
}
function getMemorialDay(year) {
    const date = new Date(year, 4, 31); // May 31
    while (date.getDay() !== 1) date.setDate(date.getDate() - 1); // last Monday
    return date.toISOString().split('T')[0];
}
function getLaborDay(year) {
    const date = new Date(year, 8, 1); // Sep 1
    while (date.getDay() !== 1) date.setDate(date.getDate() + 1); // first Monday
    return date.toISOString().split('T')[0];
}
function getThanksgiving(year) {
    const date = new Date(year, 10, 1); // Nov 1
    let count = 0;
    while (true) {
        if (date.getDay() === 4) count++; // Thursday
        if (count === 4) break;
        date.setDate(date.getDate() + 1);
    }
    return date.toISOString().split('T')[0];
}
function getThanksgivingFriday(year) {
    const thanksgiving = new Date(getThanksgiving(year));
    thanksgiving.setDate(thanksgiving.getDate() + 1);
    return thanksgiving.toISOString().split('T')[0];
}
// ============== PTO FUNCTIONS ============== //
function isPtoDay(dateStr) {
    let ptoDay = ptoMap.has(dateStr) && parseFloat(ptoMap.get(dateStr).submitted) > 0;
    return ptoDay;
}
// ============== MOBILE FUNCTIONS ============== //
function triggerGlow(glowElement) {
    // Remove both glows, then apply the one for this direction
    [glowLeft, glowRight].forEach(el => el.classList.remove('show'));
    glowElement.classList.add('show');
}
function updateGlowHeightToTable() {
    const calendar = document.getElementById('calendar-mobile');
    const table = calendar?.querySelector('table');
    const glowLeft = document.getElementById('swipe-glow-left');
    const glowRight = document.getElementById('swipe-glow-right');

    if (calendar && table && glowLeft && glowRight) {
        const tableTop = table.offsetTop;

        // Apply height and top positioning
        const tableHeight = table.offsetHeight;

        [glowLeft, glowRight].forEach(glow => {
            glow.style.height = `${tableHeight}px`;
            glow.style.top = `${tableTop}px`;
            glow.style.transform = 'translateY(0%)';
        });
    }
}
function openEntryPopup(dateStr) {
    if (window.innerWidth > 768) return; // Only allow on mobile-sized screens

    const popup = document.getElementById('day-popup');
    const popupDate = document.getElementById('popup-date');
    const popupDetails = document.getElementById('popup-details');

    popupDate.textContent = new Date(dateStr).toDateString();
    popupDetails.innerHTML = '';

    const entries = entryDayMap.get(dateStr) || [];
    const pto = ptoMap.get(dateStr);
    const isHoliday = holidayMap.has(dateStr);

    if (entries.length > 0) {
        entries.forEach(entry => {
            const div = document.createElement('div');
            div.textContent = `${entry.Hours}h - ${entry.Description}`;
            popupDetails.appendChild(div);
        });
    }

    if (pto && pto.submitted > 0) {
        const ptoDiv = document.createElement('div');
        ptoDiv.textContent = `PTO Submitted: ${pto.submitted}h`;
        popupDetails.appendChild(ptoDiv);
    }

    if (isHoliday) {
        const holidayDiv = document.createElement('div');
        holidayDiv.textContent = `Holiday: ${holidayMap.get(dateStr)}`;
        popupDetails.appendChild(holidayDiv);
    }

    if (entries.length === 0 && (!pto || pto.submitted === 0) && !isHoliday) {
        popupDetails.textContent = 'No entries for this day.';
    }

    popup.classList.remove('hidden');
}
function enableSwipeNavigation(calendar) {
    let touchStartX = 0;

    calendar.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });

    calendar.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX;

        if (Math.abs(deltaX) > 50 && !swipeCooldown) {
            swipeCooldown = true;

            if (deltaX < 0) {
                goToNextMonth();
            } else {
                goToPreviousMonth();
            }

            // prevent rapid fire
            setTimeout(() => {
                swipeCooldown = false;
            }, 400); // adjust delay as needed
        }
    });
}
// ============== SUBMIT FUNCTIONS ============== //
function updateWeekSelectMessage() {
    const message = document.getElementById('week-select-message');
    if (!message) return;

    const currentDateStr = new Date().toISOString().split('T')[0];
    const currentDate = new Date();
    let nextPayday = null;

    for (const paydayStr of paydaySet) {
        const payday = new Date(paydayStr);
        if (payday >= currentDate) {
            nextPayday = payday;
            break;
        }
    }

    if (!nextPayday) {
        message.textContent = 'Click any day to select a week for export. Press ESC to cancel.';
        return;
    }

    const deadlineDate = new Date(nextPayday);
    deadlineDate.setDate(deadlineDate.getDate() - 3); // Tuesday

    const weekEnd = new Date(nextPayday);
    const weekStart = new Date(nextPayday);
    weekStart.setDate(weekEnd.getDate() - 13);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    if (currentDateStr === deadlineDate.toISOString().split('T')[0]) {
        message.innerHTML = `<span style="color: crimson; font-weight: bold;">Today is the last day to submit for ${startStr} to ${endStr}</span>`;
    } else {
        message.textContent = 'Click any day to select a week for export. Press ESC to cancel.';
    }
}
function isWeekSubmitted(dateStr) {
    const date = new Date(dateStr);
    return submittedWeeks.some(({ WeekStart, WeekEnd }) => {
        const start = new Date(WeekStart);
        const end = new Date(WeekEnd);
        return date >= start && date <= end;
    });
}
function handleWeekSubmit(userId, startStr, endStr) {
    exportWeekToExcel(startStr, endStr);

    fetch('/SubmitWeek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ UserID: userId, WeekStart: startStr, WeekEnd: endStr })
    })
        .then(res => res.json())
        .then(() => {
            isSelectingWeek = false;
            document.getElementById('week-select-message')?.classList.remove('visible');
            queryEntries(); // refresh calendar with locked week
        })
        .catch(err => {
            console.error('Error submitting week:', err);
            alert('Failed to mark the week as submitted.');
        });
}
function clearHighlightedWeek() {
    const box = document.getElementById('active-week-outline');
    if (box) box.remove();
}
async function exportWeekToExcel(startStr, endStr) {
    const startDate = new Date(startStr + 'T00:00:00');
    const endDate = new Date(endStr + 'T00:00:00');
    const aoa = [['Date', 'Description', 'Hours', 'PTO_Submitted', 'PTO_Accrued']];

    const current = new Date(startDate);
    const userName = sessionStorage.getItem('username');
    if (!userName) { alert('Not signed in.'); return; }

    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        const entries = entryDayMap.get(dateStr) || [];
        const accrued = ptoMap.get(dateStr)?.accrued || 0;
        const submitted = ptoMap.get(dateStr)?.submitted || 0;

        if (entries.length > 0) {
            entries.forEach(entry => {
                aoa.push([
                    dateStr,
                    entry.Description,
                    entry.Description !== 'PTO Request' ? entry.Hours || '' : '',
                    entry.Description === 'PTO Request' ? submitted : '',
                    accrued
                ]);
            });
        } else if (submitted > 0) {
            aoa.push([dateStr, 'PTO Request', '', submitted, accrued]);
        } else if (holidayMap.has(dateStr)) {
            aoa.push([dateStr, 'Holiday', '', '', accrued]);
        }

        current.setDate(current.getDate() + 1);
    }

    let totalHours = 0;
    let totalPTO = 0;
    let totalHoliday = 0;
    const projectTotals = new Map();

    for (let i = 1; i < aoa.length; i++) {
        const row = aoa[i];
        const project = row[1];
        const hours = parseFloat(row[2]) || 0;
        const ptoSubmitted = parseFloat(row[3]) || 0;

        if (project === 'PTO Request') {
            totalPTO += ptoSubmitted;
            continue;
        }

        if (!projectTotals.has(project)) projectTotals.set(project, 0);
        projectTotals.set(project, projectTotals.get(project) + hours);

        if (holidayMap.has(row[0])) totalHoliday += 8;

        totalHours += hours;
    }

    aoa.push([]);
    aoa.push(['Project Totals']);

    const totalSubmitted = totalHours + totalPTO + totalHoliday;

    projectTotals.forEach((hours, project) => {
        aoa.push([project, '', hours.toFixed(2)]);
    });

    aoa.push([]);
    aoa.push(['', 'Total Hours:', totalHours.toFixed(2)]);
    if (totalHoliday > 0) aoa.push(['', 'Total Holiday Hours:', totalHoliday.toFixed(2)]);
    aoa.push(['', 'Total PTO Submitted:', totalPTO.toFixed(2)]);
    aoa.push(['', 'Total Submitted Hours:', totalSubmitted.toFixed(2), 'Submitted By:', userName]);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellRef];
            if (!cell) continue;

            const isHeader = R === 0;
            const isTotal = aoa[R]?.[0] === 'Project Totals' || (typeof aoa[R]?.[1] === 'string' && aoa[R]?.[1].includes('Total'));

            cell.s = {
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                },
                alignment: { horizontal: "center", vertical: "center" },
                font: { name: "Calibri", sz: isHeader ? 12 : 11, bold: isHeader || isTotal }
            };
        }
    }

    worksheet['!cols'] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Week Summary');
    const filename = `${startDate.toISOString().split('T')[0]}_${userName}.xlsx`;
    const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    const resp = await fetch(`/api/timesheets/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'x-username': userName
        },
        body: arrayBuffer
    });

    if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        alert('Upload failed');
        throw new Error(`upload failed: ${resp.status} ${t}`);
    }
}
// ============== ASYNC FUNCTIONS ============== //
async function queryPTO(userId, visibleDate) {
    return fetch(`/UserPTO/${encodeURIComponent(userId)}`)
        .then(res => res.json())
        .then(data => {
            ptoMap.clear();

            const accrualRate = PTO_RATE;
            const startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1st

            const visibleMonth = visibleDate.getMonth();
            const visibleYear = visibleDate.getFullYear();
            const endDate = new Date(visibleYear, visibleMonth + 1, 0); // last day of visible month

            // Build a lookup of submitted PTO days from SQL
            const submittedMap = new Map();
            data.forEach(row => {
                const dateStr = row.Date.split('T')[0];
                submittedMap.set(dateStr, parseFloat(row.PTOsubmitted));
            });

            // Get starting accrued value from SQL (first row) or default to 0
            let balance = data.length > 0 ? parseFloat(data[0].PTOaccrued) || 0 : 0;

            const current = new Date(startDate);
            while (current <= endDate) {
                const dateStr = current.toISOString().split('T')[0];
                const submitted = submittedMap.get(dateStr) || 0;

                balance += accrualRate;

                ptoMap.set(dateStr, {
                    accrued: parseFloat(balance.toFixed(2)),
                    submitted: submitted
                });

                balance -= submitted;
                current.setDate(current.getDate() + 1);
            }
        })
        .catch(err => {
            console.error('PTO Upload error:', err);

            if (err.message.includes('Violation of UNIQUE KEY')) {
                alert('You’ve already submitted PTO for one or more of these days.');
            } else {
                alert('Failed to upload PTO requests.');
            }
        });
}
async function querySubmittedWeeks(userId) {
    return fetch(`/SubmittedWeeks/${encodeURIComponent(userId)}`)
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                submittedWeeks = data;
            } else {
                console.error('SubmittedWeeks response not an array:', data);
                submittedWeeks = [];
            }
        })
        .catch(err => {
            console.error('Failed to load submitted weeks:', err);
            submittedWeeks = [];
        });
}
// ============== BUTTON FUNCTION ============== //
getEl('upload-entry').addEventListener('click', () => {
    const category = getEl('category-list').value;
    const startDateInput = getEl('entry-start');
    const endDateInput = getEl('entry-end');
    let hoursSelected = getEl('hours');

    if (!startDateInput.value) {
        alert('Please select a start date.');
        return;
    }

    const selectedCategory = category;

    const startParts = startDateInput.value.split('-');
    const startDate = new Date(
        parseInt(startParts[0]),
        parseInt(startParts[1]) - 1,
        parseInt(startParts[2])
    );

    let endDate;
    if (endDateInput.value) {
        const endParts = endDateInput.value.split('-');
        endDate = new Date(
            parseInt(endParts[0]),
            parseInt(endParts[1]) - 1,
            parseInt(endParts[2])
        );
    } else {
        endDate = new Date(startDate); // Default to same as start
    }

    const role = sessionStorage.getItem('role');
    if (role !== 'admin') {
        let nextPayday = null;
        const today = new Date();

        for (const paydayStr of paydaySet) {
            const payday = new Date(paydayStr);
            if (payday >= today) {
                nextPayday = payday;
                break;
            }
        }

        if (nextPayday) {
            const weekEnd = new Date(nextPayday);
            weekEnd.setDate(weekEnd.getDate() - 6); // Saturday before payday week

            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekEnd.getDate() - 13); // Sunday two weeks before payday week

            // Now compare entry range to pay period
            if (startDate < weekStart || endDate < weekStart) {
                alert(`You can only submit entries for dates within the current pay period (${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}).`);
                return;
            }
        }
    }

    hoursSelected = parseFloat(getEl('hours').value);
    if (isNaN(hoursSelected) || hoursSelected <= 0) {
        alert('Please select a valid number of hours.');
        return;
    }

    if (!selectedCategory || !startDate || !endDate) {
        alert('Please complete all required fields.');
        return;
    }

    if (endDate < startDate) {
        alert('End date cannot be before start date.');
        return;
    }

    if (category === 'PTO Request') {
        const userId = sessionStorage.getItem('username');

        // Parse and normalize dates
        let current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        let endDay = new Date(endDate);
        endDay.setHours(0, 0, 0, 0);

        // Prepare a list of payloads
        const requests = [];
        const accrualRate = 0.3287;          // 120h / 365d
        let runningAccrued = ptoMap.get(current.toISOString().split('T')[0])?.accrued || 0;

        while (current <= endDay) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) {    // skip Sun/Sat
                const dateStr = current.toISOString().split('T')[0];

                // 1) Use the current runningAccrued for this date
                requests.push({
                    UserID: userId,
                    Date: dateStr,
                    PTOaccrued: parseFloat(runningAccrued.toFixed(2)),
                    PTOsubmitted: hoursSelected
                });

                // 2) Subtract the PTO hours, then add daily accrual for the next day
                runningAccrued = runningAccrued - hoursSelected + accrualRate;
            }

            current.setDate(current.getDate() + 1);
        }

        // Send them all in parallel
        Promise.all(requests.map(payload =>
            fetch('/AddUserPTO', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
        ))
            .then(responses => {
                if (responses.some(r => !r.ok)) throw new Error('One or more uploads failed');
                return Promise.all(responses.map(r => r.json()));
            })
            .then(() => {
                // alert('PTO requests submitted successfully!');
                queryEntries();
            })
            .catch(err => {
                console.error('PTO Upload error:', err);
                alert('Failed to upload PTO requests.');
            });
    } else {
        // Submit as regular project entry
        const userId = sessionStorage.getItem('username');

        const payload = {
            Description: selectedCategory,
            Hours: hoursSelected,
            StartDate: startDate,
            EndDate: endDate,
            UserID: userId
        };

        fetch('/AddProjectEntry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
            })
            .then(result => {
                // alert('Entry uploaded successfully!');
                queryEntries();
            })
            .catch(err => {
                console.error('Upload error:', err);
                alert('Failed to upload project entry.');
            });
    }
});
getEl('submit-week').addEventListener('click', () => {
    const submitBtn = getEl('submit-week');
    const entrySection = document.querySelector('.entry-section');
    const message = document.getElementById('week-select-message');

    if (isMobile) {
        isSelectingWeek = !isSelectingWeek;

        if (isSelectingWeek) {
            submitBtn.textContent = 'Cancel';
            entrySection?.classList.add('hidden');
            updateWeekSelectMessage();
            message?.classList.add('visible');
        } else {
            submitBtn.textContent = 'Submit Week';
            entrySection?.classList.remove('hidden');
            message?.classList.remove('visible');
            queryEntries();
        }

        generateCalendar();
    } else {
        isSelectingWeek = true;
        updateWeekSelectMessage();
        message?.classList.add('visible');
        generateCalendar();
    }
});
getEl('remove-entry').addEventListener('click', async () => {
    const selectedBar = document.querySelector('.calendar-bar.selected');

    if (selectedBar) {
        // --- Project entry removal (unchanged) ---
        const parentTd = selectedBar.closest('td');
        const dateStr = parentTd.getAttribute('data-date');
        const description = selectedBar.getAttribute('data-fulltext');
        const text = selectedBar.textContent || '';
        const hoursMatch = text.match(/(\d+(?:\.\d+)?)h/);
        const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;

        try {
            const res = await fetch('/RemoveEntry', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Description: description, Date: dateStr, Hours: hours })
            });

            const result = await res.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to remove from server.');
            }

            if (entryDayMap.has(dateStr)) {
                const updatedEntries = entryDayMap.get(dateStr).filter(e => e.Description !== description);
                if (updatedEntries.length === 0) {
                    entryDayMap.delete(dateStr);
                } else {
                    entryDayMap.set(dateStr, updatedEntries);
                }
            }

            generateCalendar();
        } catch (err) {
            console.error('Error removing entry:', err);
            alert('Failed to remove entry from the database.');
        }

    } else {
        // --- PTO removal if no project bar is selected ---
        const selectedDay = document.querySelector('.calendar-day.selected');
        if (!selectedDay) {
            alert('Please select a project entry or a day with PTO to remove.');
            return;
        }

        const dateStr = selectedDay.getAttribute('data-date');
        const userId = sessionStorage.getItem('username');

        if (!ptoMap.has(dateStr) || parseFloat(ptoMap.get(dateStr).submitted) === 0) {
            alert('No PTO entry exists for the selected day.');
            return;
        }

        try {
            const res = await fetch('/DeleteUserPTO', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ UserID: userId, Date: dateStr })
            });

            const result = await res.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to remove PTO.');
            }

            if (ptoMap.has(dateStr)) {
                ptoMap.get(dateStr).submitted = 0;
            }
            queryEntries();
            alert('PTO entry removed successfully.');
        } catch (err) {
            console.error('Error removing PTO:', err);
            alert('Failed to remove PTO from the database.');
        }
    }
});
// ============== CLICK LISTENERS ============== //
document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('role');

    // ==================== DESKTOP CATEGORY ADD/REMOVE ====================
    const addBtn = getEl('add-category-btn');
    const removeBtn = getEl('remove-category-btn');
    const categoryList = getEl('category-list');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const newCategory = prompt('Enter a new project category:');
            if (!newCategory) return;

            const trimmed = newCategory.trim();
            if (!trimmed) return;

            if ([...categoryList.options].some(opt => opt.value.toLowerCase() === trimmed.toLowerCase())) {
                alert('That category already exists.');
                return;
            }

            fetch('/AddProject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Description: trimmed })
            })
                .then(res => {
                    if (!res.ok) throw new Error('Failed to save category.');
                    return res.json();
                })
                .then(data => {
                    if (data.success) {
                        const option = document.createElement('option');
                        option.value = trimmed;
                        option.textContent = trimmed;
                        categoryList.appendChild(option);
                        categoryList.value = trimmed;

                        if (!projectColorMap.has(trimmed)) {
                            projectColorMap.set(trimmed, getColorForProject(trimmed));
                        }

                        alert('Project category added.');
                    } else {
                        alert('Failed to add category: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(err => {
                    console.error('Add category error:', err);
                    alert('Could not add project category.');
                });
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            const selected = categoryList.value;

            if (!selected || selected === 'PTO Request') {
                alert('This category cannot be removed.');
                return;
            }

            const confirmed = confirm(`Are you sure you want to permanently remove "${selected}"?`);
            if (!confirmed) return;

            fetch(`/RemoveProject/${encodeURIComponent(selected)}`, {
                method: 'DELETE'
            })
                .then(res => {
                    if (!res.ok) throw new Error('Failed to delete category.');
                    return res.json();
                })
                .then(data => {
                    if (data.success) {
                        const option = [...categoryList.options].find(opt => opt.value === selected);
                        if (option) categoryList.removeChild(option);
                        alert('Category removed.');
                    } else {
                        alert('Failed to remove category: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(err => {
                    console.error('Remove category error:', err);
                    alert('Could not remove project category.');
                });
        });
    }

    // ==================== MOBILE ROLE-BASED CONTROL ====================
    if (role !== 'admin') {
        getEl('add-category-btn-mobile')?.remove();
        getEl('remove-category-btn-mobile')?.remove();

        const row = getEl('category-row');
        if (row) {
            row.classList.add('compact');
        }
    }

    // ==================== LOGOUT ====================
    const logoutBtn = getEl('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('role');
            window.location.href = 'login.html';
        });
    }

    // ==================== MOBILE MENU TOGGLE ====================
    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
});
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('calendar-bar')) {
        const bar = e.target;

        const alreadySelected = bar.classList.contains('selected');

        // Deselect all
        document.querySelectorAll('.calendar-bar.selected')
            .forEach(el => el.classList.remove('selected'));

        // Select only if it wasn't already selected
        if (!alreadySelected) {
            bar.classList.add('selected');
        }
    }

    if (e.target.id === 'close-popup') {
        document.getElementById('day-popup').classList.add('hidden');
    }
});
document.addEventListener('click', (e) => {
    const popup = document.getElementById('month-popup');
    if (popup && !popup.classList.contains('hidden')) {
        if (!popup.contains(e.target) && !e.target.closest('.month-header')) {
            popup.classList.add('hidden');
        }
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSelectingWeek) {
        isSelectingWeek = false;
        generateCalendar();
    }
});
// ============== DOM CONTENT ============== //
document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('role');
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);

    if (role !== 'admin') {
        document.getElementById('add-category-btn-desktop')?.remove();
        document.getElementById('remove-category-btn-desktop')?.remove();
        document.getElementById('add-category-btn-mobile')?.remove();
        document.getElementById('remove-category-btn-mobile')?.remove();
    }

    document.querySelectorAll('.category-row').forEach(row => {
        if (role === 'admin') {
            row.classList.add('admin');
        } else {
            row.classList.remove('admin');
        }
    });

    // === Mobile Legend Popup Controls ===
    const legendToggle = document.getElementById('legend-toggle');
    const legendPopup = document.getElementById('legend-popup');
    const legendClose = document.getElementById('legend-close');

    legendToggle?.addEventListener('click', () => {
        legendPopup?.classList.remove('hidden');
    });

    legendClose?.addEventListener('click', () => {
        legendPopup?.classList.add('hidden');
    });
});
// ============== MOBILE SPECIFIC ============== //
calendarMobile?.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    currentSwipeDirection = null;

    // Remove any lingering glows
    [glowLeft, glowRight].forEach(el => el.classList.remove('show'));
});
calendarMobile?.addEventListener('touchmove', (e) => {
    if (touchStartX === null) return;

    const moveX = e.touches[0].clientX;
    const deltaX = moveX - touchStartX;
    const threshold = 60;

    if (deltaX > threshold && currentSwipeDirection !== 'right') {
        triggerGlow(glowLeft); // swiping right, glow on left
        currentSwipeDirection = 'right';
    } else if (deltaX < -threshold && currentSwipeDirection !== 'left') {
        triggerGlow(glowRight); // swiping left, glow on right
        currentSwipeDirection = 'left';
    }
});
calendarMobile?.addEventListener('touchend', () => {
    touchStartX = null;
    currentSwipeDirection = null;

    // Trigger fade out via transition
    [glowLeft, glowRight].forEach(el => el.classList.remove('show'));
});
// ============== TOGGLE BUTTON ON MOBILE ============== //
toggleBtn?.addEventListener('click', () => {
    const isNowHidden = entrySection.classList.toggle('hidden');
    caret.textContent = isNowHidden ? '▼' : '▲';

    // Refresh two-week highlight after layout shift
    const paydayStr = [...paydaySet].find(p => new Date(p) >= new Date());
    if (paydayStr) {
        highlightPreviousTwoWeeks(paydayStr);
    }
});
// ============== INITIALIZE ============== //
populateHoursDropdown();
queryProjects();
queryEntries();