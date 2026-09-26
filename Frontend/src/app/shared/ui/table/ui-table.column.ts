export interface UiTableColumn<T = unknown> {
  id: string;
  label: string;
  value: (row: T) => string;
  sortValue?: (row: T) => string;
  cellClass?: string | ((row: T) => string);
  headerClass?: string;
  action?: boolean;
  badge?: boolean;
  clip?: boolean;
}
