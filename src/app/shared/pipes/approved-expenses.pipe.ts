// approved-expenses.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

interface Expense {
  id: string;
  description: string;
  amount: number;
  approved: boolean;
}

@Pipe({
  name: 'approvedExpenses',
  standalone: true,
})
export class ApprovedExpensesPipe implements PipeTransform {
  transform(expenses: Expense[] | undefined): Expense[] {
    if (!expenses || expenses.length === 0) {
      return [];
    }

    return expenses.filter((expense) => expense.approved);
  }
}
