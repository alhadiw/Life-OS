# Life OS — Product Requirements & Feature Specification

## 1. Project Overview

Life OS is a full-featured personal life management web application designed to help a single user organize every meaningful dimension of their life in one unified place. The application centers on a productivity-driven reward system: the user earns points by completing tasks and achieving goals, and those points convert into real monetary value they choose to spend on themselves. The app is not a team collaboration tool — it is deeply personal, built for one authenticated user, and designed to be used daily.

The core philosophy of the app is accountability through reward. Every completed task, achieved goal, and maintained habit generates points. Points have a user-defined monetary equivalent. This creates a tangible, motivating feedback loop between daily effort and financial self-reward.

Beyond the reward system, Life OS serves as a comprehensive life dashboard: tracking personal finances (bills, savings, investments), reading habits, exercise, and any arbitrary list the user wants to maintain — from grocery lists to movie watchlists to packing lists.

---

## 2. Authentication & User Account

The application requires user authentication. Only one account will actively use this app, but authentication must be implemented securely. The user should be able to sign up with an email and password, log in, and log out. Sessions should persist so the user does not need to log in on every visit. There should be a basic profile settings page where the user can update their name, email, and password.

---

## 3. Global Points & Money Tracker (Persistent Header)

At the very top of every page in the application, there must be a persistent header bar that is always visible regardless of what section the user is viewing. This header is the beating heart of the reward system and must display the following information at all times:

- Total lifetime points earned
- Current unspent points balance
- Total monetary value of current unspent points (calculated as: unspent points × conversion rate)
- Total money earned all-time through the points system
- The user's currently configured points-to-money conversion rate (e.g., 100 points = $1.00)

When a task or goal is marked complete, the points should update in real time in this header without requiring a page reload. The header should feel alive and responsive. A subtle visual animation or highlight effect should occur when points are added.

The conversion rate between points and money is set by the user in the Settings section and can be changed at any time. Changing the rate affects all future calculations but does not retroactively alter already-logged transactions.

---

## 4. Navigation & Layout

The application should have a clear, persistent navigation structure that allows the user to move between all major sections without losing context. Navigation can be a sidebar, top navigation bar, or a combination, but it must always be accessible. The major sections of the application are:

- Dashboard (Home)
- Tasks & Goals
- Finance Hub
- Books
- Exercise
- My Lists
- Points History
- Settings

Each section should feel distinct but visually cohesive with the rest of the app. The overall visual design should be clean, motivating, and feel like a premium personal productivity tool. Dark mode and light mode support is desirable but not required.

---

## 5. Dashboard (Home)

The Dashboard is the first screen the user sees after logging in. It is a summary view that surfaces the most important and time-sensitive information from every section of the app. The goal is to give the user a complete situational awareness of their life at a glance without needing to navigate away.

The Dashboard should include the following widgets or panels:

### 5.1 Today's Tasks
A compact list of all daily tasks that are due today, showing each task's title, point value, category, and completion status. The user should be able to check off a task directly from the dashboard without navigating to the Tasks section.

### 5.2 Weekly Goals Summary
A progress overview of the current week's goals, showing how many weekly goals are complete versus total, with a visual progress indicator (such as a progress bar or percentage).

### 5.3 Monthly Goals Summary
Same as the weekly summary but scoped to the current month.

### 5.4 Finance Snapshot
A small panel showing: total upcoming bills due within the next 7 days and their combined total amount, current savings balance across all savings goals, and the current total invested amount.

### 5.5 Exercise This Week
A brief summary of exercise activity logged this week versus any weekly exercise goal the user has set.

### 5.6 Currently Reading
The title and author of any book the user has marked as currently reading, with a note of the last logged progress if available.

### 5.7 Quick Add
A quick-add button or input on the dashboard that allows the user to rapidly add a new daily task without navigating to the Tasks section.

---

## 6. Tasks & Goals

This is the core productivity section of the application. Tasks and goals are organized into three tiers based on their time horizon, and each tier has different point values and reset behavior.

### 6.1 Task & Goal Tiers

**Daily Tasks**

Daily tasks are things the user wants to accomplish on a given day. They reset every day — uncompleted tasks from yesterday do not automatically carry over (though the user can manually duplicate or reschedule them). Daily tasks carry the lowest point values, suggested range of 10 to 50 points each, but the exact value is set by the user when creating the task.

Each daily task must have: a title, a point value, an optional category tag (e.g., Health, Work, Finance, Personal, Learning), an optional due date if it is not just for today, and a completion toggle. When a task is marked complete, the points are immediately added to the user's balance and logged in the Points History.

**Weekly Goals**

Weekly goals are larger objectives the user wants to achieve within a given calendar week (Monday through Sunday). They carry medium point values, suggested range of 100 to 500 points. Weekly goals that are not completed by end of week are marked expired and the user can choose to roll them over to the next week or archive them.

Each weekly goal must have: a title, a point value, an optional description or notes field, a category tag, a target week (defaulting to current week), and a completion toggle. The user should be able to see all past weeks' goals and their completion status.

**Monthly Goals**

Monthly goals represent the user's biggest objectives for a given calendar month. They carry the highest point values, suggested range of 500 to 2000 points. Monthly goals follow the same structure as weekly goals but scoped to a calendar month.

Each monthly goal must have: a title, a point value, an optional description, a category tag, a target month, a completion toggle, and an optional progress notes field where the user can journal about their progress throughout the month.

### 6.2 Task & Goal Management

The Tasks & Goals section should have a tabbed or segmented view allowing the user to switch between Daily, Weekly, and Monthly views. Within each view, the user can:

- Create new tasks or goals with full detail
- Edit existing tasks or goals
- Delete tasks or goals
- Mark tasks or goals as complete (which triggers the point reward)
- Filter by category
- Search by title
- View completed tasks and goals in a separate completed section or with a toggle

For weekly and monthly goals, there should be a way to view goals from past periods, not just the current period, so the user can review their history.

### 6.3 Points Assignment

When creating a task or goal, the user manually sets the point value. The application does not auto-assign points. The user decides how much each task or goal is worth based on their own judgment of its difficulty and importance. The app should show a suggested range for context but never override the user's chosen value.

---

## 7. Finance Hub

The Finance Hub is a personal financial tracking section. It is not a budgeting app and does not connect to bank accounts. All data is entered manually. The Finance Hub has three sub-sections: Bills, Savings, and Investments.

### 7.1 Bills Tracker

The Bills Tracker allows the user to log all recurring and one-time bills and track whether they have been paid. Each bill entry must include:

- Bill name (e.g., Rent, Electric, Netflix)
- Amount due
- Due date
- Frequency: one-time, weekly, monthly, quarterly, or annual
- Category (e.g., Housing, Utilities, Subscriptions, Insurance, Debt)
- Paid/unpaid toggle
- Optional notes

For recurring bills, the app should automatically generate the next occurrence when the current one is marked paid. The user should be able to see: all upcoming bills sorted by due date, overdue bills highlighted prominently, a monthly total of all bills, and a list of all past bills.

### 7.2 Savings Tracker

The Savings Tracker allows the user to create named savings goals and track progress toward them. Each savings goal must include:

- Goal name (e.g., Emergency Fund, Vacation, New Car)
- Target amount
- Current saved amount
- Target date (optional)
- Notes

The user should be able to log deposits to a savings goal, which increases the current saved amount. Each savings goal should display a visual progress bar showing percentage toward the target. The section should also show a total current savings balance across all goals.

### 7.3 Investments Tracker

The Investments Tracker is a simple manual log of the user's investment activity. It does not pull live market data. Each investment entry must include:

- Platform or account name (e.g., Robinhood, 401k, Crypto Exchange)
- Asset or description (e.g., S&P 500 Index Fund, Bitcoin)
- Amount invested
- Date of investment
- Optional notes

The section should display a total invested amount across all entries and allow the user to view their full investment history sorted by date. The user should be able to edit or delete any entry.

---

## 8. Books Tracker

The Books section allows the user to maintain a personal reading library with full lifecycle tracking from discovery to completion.

### 8.1 Book Entry

Each book in the library must include:

- Title
- Author
- Status: Want to Read, Currently Reading, or Finished
- Genre or category (optional, user-defined tags)
- Rating (1 to 5 stars, only applicable to finished books)
- Personal notes or review (free text field)
- Date started (optional)
- Date finished (optional)
- Cover image (optional — user can paste a URL or upload an image)

### 8.2 Library Views

The Books section should offer multiple ways to view the library:

- A shelf or grid view organized by status (Want to Read, Currently Reading, Finished)
- A list view with all books sortable by title, author, date finished, or rating
- A filter by genre or tag
- A search by title or author

The user should be able to move a book between statuses (e.g., from Want to Read to Currently Reading) with a single action.

### 8.3 Reading Stats

The Books section should display basic reading statistics: total books finished, total books in progress, total books in want-to-read queue, and books finished this year. These stats can appear at the top of the section.

---

## 9. Exercise Tracker

The Exercise section allows the user to log workouts, set exercise goals, and monitor their fitness consistency over time.

### 9.1 Workout Log

The user can log individual workout sessions. Each workout log entry must include:

- Workout type (e.g., Running, Weightlifting, Yoga, Cycling, Swimming — the user can define custom types)
- Duration in minutes
- Date
- Optional notes (e.g., how it felt, what was accomplished, distance covered)
- Optional intensity level: Light, Moderate, or Intense

The user should be able to view their full workout history, filter by workout type, and see a calendar or timeline view showing which days they exercised.

### 9.2 Exercise Goals

The user can set exercise goals with the following fields:

- Goal title (e.g., Run 3 times this week, Exercise 20 days this month)
- Goal type: weekly or monthly
- Target metric: number of sessions, total minutes, or total days active
- Target value (the number the user is aiming for)
- Current progress (auto-calculated from logged workouts where possible, or manually updateable)

Each exercise goal displays a progress bar. When a goal is marked complete (automatically or manually), the user can optionally award themselves points by linking the exercise goal to a points reward — this integrates with the main points system.

### 9.3 Exercise Summary

At the top of the Exercise section, display a summary showing: total workouts logged all-time, workouts this week, workouts this month, total minutes exercised this month, and current streak (consecutive days with at least one workout logged).

---

## 10. My Lists (General Purpose List Manager)

The My Lists section is a flexible, general-purpose list manager. The user can create any number of named lists and add items to those lists. This feature is intended for things like grocery lists, movie watchlists, packing lists, shopping wishlists, to-research lists, or anything else the user wants to track in a simple checklist format.

### 10.1 List Templates

Each list is treated as a template or container. Creating a list requires:

- List name (e.g., Groceries, Movies to Watch, Books to Buy, Travel Packing)
- Optional icon or emoji to visually identify the list
- Optional color tag for visual organization

The user can create as many lists as they want. Lists are displayed in the My Lists section as cards or rows that the user can tap or click to open.

### 10.2 List Items

Inside each list, the user can add, edit, delete, and reorder items. Each item must have:

- Text content (the item name or description)
- A checkbox to mark the item as done or checked off
- Optional notes or sub-text

The user should be able to bulk-clear all checked items from a list with a single action (e.g., a "clear completed" button). Items can be reordered via drag-and-drop or up/down controls. The total item count and checked-off count should be visible on the list card in the overview.

---

## 11. Points History

The Points History section is a complete, chronological log of every point transaction. Every time the user earns points (by completing a task, goal, or exercise goal), a transaction record is created and stored. Each transaction record includes:

- Timestamp (date and time)
- Points earned
- Source description (e.g., "Completed daily task: Morning Run", "Completed weekly goal: Read 3 chapters")
- Monetary value of that transaction based on the conversion rate at the time

The history should be paginated or infinitely scrollable. The user should be able to filter by date range and search by source description. At the top of the history, display aggregate stats: total transactions, total points earned all-time, and total money equivalent earned all-time.

There should also be a way to log points redemptions — when the user decides to spend their earned money on something, they can log that as a redemption event with a description and amount, which reduces their unspent points balance accordingly.

---

## 12. Settings

The Settings section allows the user to configure the application to their preferences. It must include the following configurable options:

### 12.1 Points Conversion Rate
The user sets how many points equal one dollar (or their chosen currency). For example, they may decide 100 points = $1.00, or 50 points = $1.00. This rate can be changed at any time. The new rate applies going forward. The app should show a preview of how existing unspent points translate to money under the new rate before the user saves the change.

### 12.2 Currency
The user can select their preferred currency symbol (e.g., $, €, £). This is a display-only setting and does not involve any real currency conversion.

### 12.3 Categories
The user can manage the category tags used across Tasks, Goals, Finance, and Books. They can add new categories, rename existing ones, and delete unused ones. Deleting a category should prompt the user about what to do with items currently assigned to that category.

### 12.4 Weekly Reset Day
The user can configure which day of the week their week begins — Sunday or Monday. This affects how weekly goals and weekly exercise summaries are calculated.

### 12.5 Profile
The user can update their display name, email address, and password from the Settings section.

### 12.6 Data Export
The user should be able to export all of their data (tasks, goals, finance entries, books, exercise logs, list items, points history) as a JSON or CSV file. This is a one-click export for personal backup purposes.

---

## 13. Data Persistence & Behavior Requirements

All data entered by the user must persist permanently unless explicitly deleted by the user. The application must use a real backend database — no local-only storage that would be lost when the browser is cleared.

The following behavioral requirements apply across the entire application:

- All point-earning actions must create a corresponding transaction in the Points History — no points can be silently added.
- Unchecking a completed task or goal (undoing a completion) must remove the associated points from the user's balance and delete or reverse the corresponding transaction.
- All monetary values displayed in the app should respect the user's chosen currency symbol.
- Data should load quickly — the app should feel snappy and responsive even on a mobile browser.
- The app must be fully functional on both desktop and mobile screen sizes. The layout should be responsive and usable on a phone without horizontal scrolling or broken layouts.
- Forms throughout the app should validate inputs and show clear, human-readable error messages when something is missing or invalid.
- All delete actions across the entire app must require a confirmation step before the data is permanently removed.
- The app should handle loading states gracefully — when data is being fetched from the database, a loading indicator should appear rather than showing blank content.

---

## 14. Visual Design Requirements

The application should feel premium, personal, and motivating. It is not a corporate productivity tool — it is a personal companion for self-improvement. The design should reflect that: it should feel warm, encouraging, and satisfying to use every day.

Key visual design requirements:

- The persistent points and money header should be visually prominent and feel like a reward dashboard — it should be the first thing the user notices.
- Progress bars, completion percentages, and streaks should be visually engaging, not just plain text numbers.
- Completing a task or goal should feel rewarding — a small celebratory animation, visual feedback, or satisfying micro-interaction is expected.
- Color should be used purposefully: overdue bills should feel urgent (warm red or orange), completed items should feel satisfying (green or checkmark styles), progress toward goals should feel encouraging (blue or teal progress bars).
- Typography should be readable and clear. Body text should not be too small on mobile.
- The dashboard should feel like a morning briefing — organized, prioritized, and easy to scan in under 30 seconds.
- Empty states (e.g., no tasks added yet, no books logged) should show friendly, helpful prompts that guide the user to add their first item rather than just showing a blank area.

---

## 15. Out of Scope

The following features are explicitly out of scope for this version of Life OS:

- Multi-user support or team collaboration features
- Automatic bank or financial account synchronization
- Live stock or crypto price tracking in the investments section
- Social sharing or public profiles
- Native mobile app (iOS or Android) — this is a web application only
- AI or machine learning features
- Integration with third-party services (Google Calendar, Apple Health, etc.) — all data is entered manually

---

*End of Specification — Life OS v1.0*