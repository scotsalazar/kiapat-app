import type { InventoryItem } from './types';
import { inventoryItems as defaultInventory } from './dashboardData';

interface InventoryPaneProps {
  items?: InventoryItem[];
  className?: string;
  showHeader?: boolean;
}

const InventoryPane = ({ items = defaultInventory, className = '', showHeader = true }: InventoryPaneProps) => {
  const containerClasses = `flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`.trim();

  return (
    <section className={containerClasses}>
      {showHeader && (
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Warehouse snapshot
            </p>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
              Inventory watch
            </h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Tracking {items.length} active stock lines
            </p>
          </div>
          <p className="text-xs leading-5 text-slate-500">Updated automatically for demo data</p>
        </header>
      )}

      <div className="mt-6 flex-1 overflow-auto">
        <table className="min-w-full text-left text-sm" aria-label="Available inventory levels by item">
          <caption className="sr-only">Inventory overview with quantity and unit information</caption>
          <thead className="sticky top-0 hidden border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 sm:table-header-group">
            <tr>
              <th scope="col" className="px-0 py-3">Item</th>
              <th scope="col" className="px-0 py-3 text-right">Quantity</th>
              <th scope="col" className="px-0 py-3 text-right">Unit</th>
            </tr>
          </thead>
          <tbody className="sm:divide-y sm:divide-slate-100 dark:sm:divide-slate-800">
            {items.map((item) => {
              const isLowStock = item.quantity <= item.reorderThreshold;
              return (
                <tr
                  key={item.id}
                  className="block border-b border-slate-100 py-4 last:border-b-0 dark:border-slate-800 sm:table-row sm:border-0 sm:py-3"
                >
                  <th
                    scope="row"
                    className="block text-base font-semibold leading-6 text-slate-900 dark:text-white sm:table-cell sm:text-sm"
                  >
                    <div className="space-y-1">
                      <p className="tracking-tight">{item.name}</p>
                      <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                        {item.category} · {item.warehouse}
                      </p>
                    </div>
                  </th>
                  <td className="mt-3 flex items-center justify-between text-base sm:mt-0 sm:table-cell sm:text-right">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:hidden">
                      Quantity
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold sm:justify-end sm:text-sm ${
                        isLowStock
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                      }`}
                    >
                      {item.quantity.toLocaleString()}
                    </span>
                  </td>
                  <td className="mt-3 flex items-center justify-between text-base text-slate-600 dark:text-slate-300 sm:mt-0 sm:table-cell sm:text-right">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:hidden">
                      Unit
                    </span>
                    <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">{item.unit}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default InventoryPane;
