import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sentenceCase',
  standalone: false,
})
export class SentenceCasePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value === null || value === undefined || value.length === 0) {
      return '';
    }

    const strValue = String(value); // Ensure it's treated as a string

    return strValue.charAt(0).toUpperCase() + strValue.slice(1).toLowerCase();
  }
}
