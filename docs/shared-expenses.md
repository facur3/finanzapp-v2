# Shared expenses — proposal (not implemented)

Status: **proposal**, recorded 2026-10-17 at the owner's request. Nothing here is programmed, tested or validated on an
iPhone. It changes what the ledger stores and several of decision 003's accounting invariants (§3), so it waits for the
owner's decision (below) before any code. Read with [decision 003](decisions/003-five-tabs-and-cards.md) (cards and debts as
internal accounts) and `packages/domain/card-invariants.test.ts`.

## 1. The case it must get right

A football pitch for ten people costs 50.000. Usually one person pays it all; sometimes two split the bill at the
counter; people pay back in parts, by transfer or in cash, days apart; next week the same ten play again. FinanzApp is a
personal ledger on one phone: the other nine never install anything, and nothing here talks to a server.

What the person must see, at any time: what the pitch cost them (their share), what they put in, what they are still
owed or still owe, and who should pay whom so the group settles with the fewest payments.

## 2. What Splitwise and Tricount teach, and what FinanzApp does differently

- **Splitwise:** groups, an expense «paid by X, split equally / by amounts / by shares», per-person balances, «simplify
  debts», «settle up» as a recorded payment. Strong at the long-running group; heavy at the moment of paying (many
  fields), and its balances live apart from the person's real money.
- **Tricount:** one shared list per trip or event, no account needed to take part, a «balances» screen and the
  suggested reimbursements. Fast to start; nothing connects it to the person's own accounts.
- **FinanzApp's own angle:** the split is recorded where the money already is. The person's share is a real expense in
  their reports and budgets, the cash they put in leaves their real account, and what the group owes them sits beside
  «Me deben». A shared expense never inflates spending (only the share is an expense) and a repayment is never income.

## 3. Accounting (the part that needs the owner)

One **group** is one internal account, like a card or a personal debt (decision 003): its balance is the person's
**net position with the group**, positive when the group owes them, negative when they owe it. It is excluded from
«Disponible», like debts and cards. The split between the other members (who owes whom among them) is **group
metadata** computed from the group's expenses; it never posts to the ledger, because it is not the person's money.

A group expense posts, in one atomic operation with one operation id (so editing or undoing it moves every leg):

| Leg | Amount | Effect |
| --- | --- | --- |
| Expense, in the expense's category, **funded by the group account** | the person's share | spending and budgets see only the share |
| Transfer, from each of the person's accounts that paid, **into the group account** | what the person put in | «Disponible» falls by exactly what left their account |

The group balance after it is `paid − share`. The football cases:

| Case | Ledger legs | Group balance |
| --- | --- | --- |
| The person paid 50.000, share 5.000 | expense 5.000 from the group; transfer 50.000 cash → group | +45.000 (owed to them) |
| Juan paid it all, share 5.000 | expense 5.000 from the group | −5.000 (they owe) |
| The person 20.000 and Juan 30.000 | expense 5.000 from the group; transfer 20.000 cash → group | +15.000 |
| Pedro pays them back 4.500 | transfer 4.500 group → cash | +40.500 (case 1) |
| They pay Juan 5.000 | transfer 5.000 cash → group | 0 (case 2) |
| The person paid 50.000 **by card**, no instalments | one card purchase of 50.000 **split** in two legs: expense 5.000 (the share) and 45.000 into the group account | +45.000; the card owes 50.000; spending 5.000 |
| By card **in instalments** | not in v1 (below) | — |

Partial payments are any amount; a payment names who it came from or went to (metadata for the per-member balances),
and the ledger sees one transfer. Nothing is counted twice: the full 50.000 is never an expense of the person, and a
repayment is never income.

**The card case.** Paying the pitch by card is common, and decision 003 forbids the obvious posting: «una tarjeta nunca
es origen de una transferencia» (rule 3), so the 45.000 cannot move from the card to the group, and recording the
purchase as one 50.000 expense (rule 2) would count the others' part as spending. The proposal is a **split card
purchase**: one purchase that raises the card's balance due by 50.000 (the issuer is owed the whole price) and posts
two legs, the 5.000 share as the expense and 45.000 into the group account. Paying the card stays a plain transfer
(rule 3), so nothing is counted twice. A purchase **in instalments** recognises its principal instalment by instalment
(rule 7); splitting each instalment between a share and a receivable is a second design and stays out of v1 (the form
offers Dividir only on a purchase without instalments, and says so).

**The invariants this changes (decision 003).** Today storage refuses an expense or an income posted directly on a debt
account («Un gasto o ingreso directo sobre una deuda se rechaza en el almacenamiento»), and the card invariants say
that a card is never the source of a transfer (rule 3), that an internal account represents one obligation (rule 5)
and that the account types are exactly cash, card and debt (rule 6). A group account is a **fourth account kind**
(rule 6) that **nets several counterparties** into one balance (rule 5) and may **fund an expense** (the person's share
only); a card purchase may be **split** between an expense and the group account (beside rule 2). That is a change of
data semantics: a new stored profile (the group, its members, its expenses with payers and shares, its member-to-member
payments), new posting rules pinned in `card-invariants.test.ts`, a schema migration and a backup version. **Owner
decision needed** before any code; the recommendation is to accept it, because every alternative either counts the
50.000 as spending, or hides the person's share from reports.

Rules to pin with tests when built: the shares of an expense add up to its total exactly in minor units (the remainder
of an uneven split goes to named members, never lost); the payers add up to the total; a group has one currency (a
foreign-currency group expense waits for the international-purchases design); a group with a non-zero balance or
recorded payments is closed, never deleted (the debt rule); undoing a group expense undoes every leg.

## 4. Experience

- **Where it lives.** Recording happens where expenses are recorded: the expense form gains one optional control,
  «Dividir», under the amount; nothing changes for a person who never opens it. The groups live in the financial hub
  (see the navigation proposal in the roadmap §3) as «Compartidos»; each group's net balance also appears in «Deudas y
  cobros» so «Me deben» stays the one answer to «who owes me». No new tab.
- **Dividir, in three decisions at most (Hick).** Who (a saved group, or names typed once and offered again); how
  (equally by default; by amounts or by shares behind one switch); who paid (the person, by default; «Otra persona» or
  «Varios»). The person's share is shown live under the amount («Tu parte: 5.000»), the total stays the hero.
- **The group screen.** The net balance as the numeral (the brand's hero), then «Quién le paga a quién» as the fewest
  payments (a greedy settle of the per-member balances), then the expenses. Each suggested payment that involves the
  person has «Registrar pago», prefilled, which records the transfer; payments between two other members are recorded
  as group metadata only.
- **Reuse.** Groups persist; «Repetir» on an expense copies its members, split and payers to today. Archived groups keep
  their history.
- **The Assistant.** «Pagué la cancha, 50 mil, éramos 10» proposes a split draft for review, like any proposal; never a
  write without confirmation.
- **Craft and accessibility.** One primary action per screen; the per-member list is text first, with amounts read by
  VoiceOver through spoken twins; Dynamic Type stacks names over amounts before shrinking; a settled group says so in
  words, not only in colour; a payment recorded gives the success haptic once; Reduce Motion removes the balance count.

## 5. Minimum scope (v1) and what waits

- **v1:** groups with members typed by name; equal, amounts or shares; one or several payers; the person's share as an
  expense; partial repayments both ways; suggested settlements; reuse and archive; backup and restore; undo.
- **Later:** contacts from iOS (a permission, only on demand), receipts and items, foreign-currency expenses inside a
  group, exporting a group's summary to share as text, recurring group expenses (the weekly pitch), and any sync or
  invitation (never without the sync design, decision 001 and the privacy plan).

## 6. Owner decisions

1. Accept the group account (a fourth account kind netting several people, against rules 5 and 6), an expense funded
   by it (the person's share only) and the split card purchase (beside rules 2 and 3), with the schema migration and
   backup version they need; instalment purchases stay out of v1.
2. Whether v1 shows group balances inside «Deudas y cobros» as well as in «Compartidos» (recommended: yes, read-only).
3. When it enters the plan (recommended: after milestone M1 and the VoiceOver delivery, before the App Store shell).
