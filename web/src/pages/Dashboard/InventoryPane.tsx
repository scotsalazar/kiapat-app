import type { InventoryItem } from './types';
import { inventoryItems as defaultInventory } from './dashboardData';

interface InventoryPaneProps {
  items?: InventoryItem[];
}

const InventoryPane = ({ items = defaultInventory }: InventoryPaneProps) => {
  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">Warehouse snapshot</p>
          <h2 className="text-2xl font-semibold text-slate-900">Inventory watch</h2>
          <p className="text-sm text-slate-500">Tracking {items.length} active stock lines</p>
        </div>
        <p className="text-xs text-slate-500">Updated automatically for demo data</p>
      </header>

      <div className="mt-6 max-h-[420px] overflow-auto">
        <table className="min-w-full text-left text-sm" aria-label="Available inventory levels by item">
          <caption className="sr-only">Inventory overview with quantity and unit information</caption>
          <thead className="sticky top-0 hidden border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-header-group">
            <tr>
              <th scope="col" className="px-0 py-3">Item</th>
              <th scope="col" className="px-0 py-3 text-right">Quantity</th>
              <th scope="col" className="px-0 py-3 text-right">Unit</th>
            </tr>
          </thead>
          <tbody className="sm:divide-y sm:divide-slate-100">
            {items.map((item) => {
              const isLowStock = item.quantity <= item.reorderThreshold;
              return (
                <tr
                  key={item.id}
                  className="block border-b border-slate-100 py-4 last:border-b-0 sm:table-row sm:border-0 sm:py-3"
                >
                  <th
                    scope="row"
                    className="block text-base font-semibold text-slate-900 sm:table-cell sm:text-sm"
                  >
                    <div>
                      <p>{item.name}</p>
                      <p className="text-xs font-normal uppercase tracking-wide text-slate-500">
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
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {item.quantity.toLocaleString()}
                    </span>
                  </td>
                  <td className="mt-3 flex items-center justify-between text-base text-slate-600 sm:mt-0 sm:table-cell sm:text-right">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:hidden">
                      Unit
                    </span>
                    <span className="font-semibold text-slate-900">{item.unit}</span>
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
