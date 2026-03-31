import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { normalizeRecipe, type RecipeRecord } from '../../models/recipe';
import { newRecipeDialogConfig } from '../new-recipe/new-recipe-dialog.config';
import { NewRecipeDialogComponent } from '../new-recipe/new-recipe-dialog.component';
import { ApiService } from '../../services/api.service';
import { RecipeListRefreshService } from '../../services/recipe-list-refresh.service';

function httpErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error === 'string' && err.error.trim()) return err.error;
    return err.message || `Failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Could not load recipes';
}

@Component({
  selector: 'app-recipe-box',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recipe-box.html',
  styleUrl: './recipe-box.sass',
})
export class RecipeBoxPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly recipeListRefresh = inject(RecipeListRefreshService);

  readonly recipes = signal<RecipeRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');

  readonly filtered = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.recipes();
    if (!q) return list;
    return list.filter((r) => (r.title || '').toLowerCase().includes(q));
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.searchQuery.set(params.get('q') ?? '');
    });
  }

  ngOnInit(): void {
    this.loadRecipes();
  }

  loadRecipes(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<unknown[]>('/recipes')
      .pipe(
        catchError((err) => {
          this.error.set(httpErrorMessage(err));
          return of([]);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((data) => {
        if (!Array.isArray(data)) {
          this.recipes.set([]);
          return;
        }
        this.recipes.set(data.map((row) => normalizeRecipe(row)));
      });
  }

  onSearchInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: v.trim() ? v : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ingredientPreview(r: RecipeRecord): string | null {
    const ing = (r.ingredients ?? []).filter(Boolean);
    if (!ing.length) return null;
    const text = ing.slice(0, 4).join(' · ');
    return ing.length > 4 ? `${text}…` : text;
  }

  instructionPreview(instructions?: string): string | null {
    if (instructions == null) return null;
    const text = String(instructions).trim();
    if (!text) return null;
    const max = 80;
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
  }

  formatDifficulty(d?: string): string {
    if (!d) return '—';
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  editRecipe(r: RecipeRecord): void {
    if (!r._id) return;
    this.dialog.open(NewRecipeDialogComponent, newRecipeDialogConfig({ recipeId: r._id }));
  }
}
