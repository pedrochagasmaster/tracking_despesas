PYTHON ?= python

.PHONY: help init test-cli smoke gen-workbook

help:
	@echo "Available targets:"
	@echo "  make init          - initialize default SQLite database (expenses.db)"
	@echo "  make test-cli      - syntax + CLI help checks"
	@echo "  make smoke         - lightweight end-to-end CLI smoke flow on temp DB"
	@echo "  make gen-workbook  - generate robust workbook template and prefilled file"

init:
	$(PYTHON) expense_cli.py init

test-cli:
	$(PYTHON) -m py_compile expense_cli.py
	$(PYTHON) expense_cli.py --help

smoke:
	$(PYTHON) expense_cli.py --db smoke_test.db init
	$(PYTHON) expense_cli.py --db smoke_test.db add-expense --date 2026-02-05 --amount 1100 --category Moradia --description "Aluguel"
	$(PYTHON) expense_cli.py --db smoke_test.db add-income --date 2026-02-05 --amount 12418 --category Salario --description "Pagamento"
	$(PYTHON) expense_cli.py --db smoke_test.db add-subscription --name Netflix --amount 45 --category Streaming --frequency monthly --start-date 2026-01-10
	$(PYTHON) expense_cli.py --db smoke_test.db run-subscriptions --month 2026-02
	$(PYTHON) expense_cli.py --db smoke_test.db add-installment --description "Notebook" --category Eletronicos --total-amount 2400 --installments 12 --start-date 2026-02-15
	$(PYTHON) expense_cli.py --db smoke_test.db set-budget --category Moradia --amount 1300
	$(PYTHON) expense_cli.py --db smoke_test.db report-month --month 2026-02
	$(PYTHON) expense_cli.py --db smoke_test.db report-trends --months 2
	$(PYTHON) expense_cli.py --db smoke_test.db report-savings --month 2026-02 --target-rate 20

gen-workbook:
	$(PYTHON) scripts/generate_workbooks.py
