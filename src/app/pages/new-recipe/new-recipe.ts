import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

type Difficulty = 'easy' | 'medium' | 'hard';

function parseIngredients(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function submitErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Network error';
}

@Component({
  selector: 'app-new-recipe',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './new-recipe.html',
  styleUrl: './new-recipe.sass',
})
export class NewRecipePage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    ingredientsText: [''],
    instructions: [''],
    difficulty: this.fb.nonNullable.control<Difficulty>('easy'),
    cooking_time: [0, Validators.min(0)],
  });

  onSubmit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const title = v.title.trim();
    if (!title) {
      this.error.set('Title is required.');
      return;
    }
    const rawTime = v.cooking_time;
    const cookingTime =
      typeof rawTime === 'number' && Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
    const payload = {
      title,
      ingredients: parseIngredients(v.ingredientsText),
      instructions: v.instructions.trim(),
      difficulty: v.difficulty,
      cooking_time: cookingTime,
    };
    this.submitting.set(true);
    this.api
      .postText('/recipes', payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/recipe-box']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(submitErrorMessage(err));
      },
    });
  }

  fillExample(): void {
    this.error.set(null);
    this.form.patchValue({
      title: 'Quick tomato pasta',
      ingredientsText: ['spaghetti', 'olive oil', 'garlic', 'canned tomatoes', 'fresh basil'].join('\n'),
      instructions:
        'Cook pasta. Sauté garlic in oil, add tomatoes, simmer. Toss with pasta and basil.',
      difficulty: 'easy',
      cooking_time: 25,
    });
  }

  clearForm(): void {
    this.error.set(null);
    this.form.reset({
      title: '',
      ingredientsText: '',
      instructions: '',
      difficulty: 'easy',
      cooking_time: 0,
    });
  }
}
