import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import type { Product, ProductPayload } from '../types/products';

interface ProductFormState {
  price_per_pcs: string;
  price_per_dozen: string;
  price_per_tray: string;
}

const defaultFormState: ProductFormState = {
  price_per_pcs: '',
  price_per_dozen: '',
  price_per_tray: '',
};

const ProductsPage: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(defaultFormState);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const currency = useMemo(() => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }), []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.get<Product[]>('/api/products');
      setProducts(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
        setLoading(false);
        return;
      }
      const { message } = parseApiError(err, 'Unable to load products');
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [logout, showToast]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadProducts();
  }, [loadProducts, navigate, token]);

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingProduct(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editingProduct) {
      setFormError('Select a product to edit prices.');
      return;
    }

    const payload: ProductPayload = {
      size: editingProduct.size,
      color: editingProduct.color,
      price_per_pcs: formState.price_per_pcs ? Number(formState.price_per_pcs) : null,
      price_per_dozen: formState.price_per_dozen ? Number(formState.price_per_dozen) : null,
      price_per_tray: formState.price_per_tray ? Number(formState.price_per_tray) : null,
      is_active: editingProduct.is_active,
    };

    try {
      await apiClient.put(`/api/products/${editingProduct.id}`, payload);
      showToast('Product updated', 'success');
      resetForm();
      loadProducts();
    } catch (err) {
      const { message } = parseApiError(err, 'Unable to save product');
      setFormError(message);
      showToast(message, 'error');
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormState({
      price_per_dozen: product.price_per_dozen?.toString() ?? '',
      price_per_pcs: product.price_per_pcs?.toString() ?? '',
      price_per_tray: product.price_per_tray?.toString() ?? '',
    });
  };

  const renderPrice = (value?: number | null) =>
    value !== undefined && value !== null ? currency.format(value) : t('common.notAvailable');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Products</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Manage catalog items and default prices</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Product list</h2>
              {loadError && <p className="text-sm text-red-500">{loadError}</p>}
            </div>
            <button
              type="button"
              onClick={loadProducts}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Size</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Color</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Price (pcs)</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Price (dozen)</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Price (tray)</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{product.size}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{product.color}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{renderPrice(product.price_per_pcs)}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{renderPrice(product.price_per_dozen)}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{renderPrice(product.price_per_tray)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            product.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(product)}
                            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Edit price
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                        No products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit product prices</h2>
              {formError && <p className="text-sm text-red-500">{formError}</p>}
            </div>
            {editingProduct && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                Clear
              </button>
            )}
          </div>
          {editingProduct ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Price per piece (PHP)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={formState.price_per_pcs}
                    onChange={(e) => setFormState((prev) => ({ ...prev, price_per_pcs: e.target.value }))}
                    placeholder="e.g. 8.50"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Price per dozen (PHP)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={formState.price_per_dozen}
                    onChange={(e) => setFormState((prev) => ({ ...prev, price_per_dozen: e.target.value }))}
                    placeholder="e.g. 100"
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Price per tray (PHP)
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    value={formState.price_per_tray}
                    onChange={(e) => setFormState((prev) => ({ ...prev, price_per_tray: e.target.value }))}
                    placeholder="e.g. 250"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Save prices
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              Select a product from the list to edit its prices. Only existing sizes (S, M, L, XL) can be updated.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
