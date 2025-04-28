import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'approvedExpenses',
})
export class ApprovedExpensesPipe implements PipeTransform {
  transform(expenses: any[]): any[] {
    return expenses?.filter((expense) => expense.approved) || [];
  }
}
