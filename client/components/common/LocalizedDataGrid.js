import React, { useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";

const paginationLabel = (t, type) => ({
  first: t("dataGrid.firstPage"),
  last: t("dataGrid.lastPage"),
  next: t("dataGrid.nextPage"),
  previous: t("dataGrid.previousPage"),
}[type]);

const LocalizedDataGrid = ({ localeText: localeTextOverrides, ...props }) => {
  const { t } = useTranslation("common");
  const localeText = useMemo(() => ({
    noRowsLabel: t("dataGrid.noRows"),
    noResultsOverlayLabel: t("dataGrid.noResults"),
    toolbarColumns: t("dataGrid.columns"),
    toolbarColumnsLabel: t("dataGrid.selectColumns"),
    toolbarFilters: t("dataGrid.filters"),
    toolbarFiltersLabel: t("dataGrid.showFilters"),
    toolbarFiltersTooltipHide: t("dataGrid.hideFilters"),
    toolbarFiltersTooltipShow: t("dataGrid.showFilters"),
    toolbarFiltersTooltipActive: (count) => t("dataGrid.activeFilters", { count }),
    columnsPanelTextFieldLabel: t("dataGrid.findColumn"),
    columnsPanelTextFieldPlaceholder: t("dataGrid.columnTitle"),
    columnsPanelShowAllButton: t("dataGrid.showAll"),
    columnsPanelHideAllButton: t("dataGrid.hideAll"),
    filterPanelAddFilter: t("dataGrid.addFilter"),
    filterPanelRemoveAll: t("dataGrid.removeAll"),
    filterPanelDeleteIconLabel: t("dataGrid.deleteFilter"),
    filterPanelOperator: t("dataGrid.operator"),
    filterPanelOperatorAnd: t("dataGrid.and"),
    filterPanelOperatorOr: t("dataGrid.or"),
    filterPanelInputLabel: t("dataGrid.value"),
    filterPanelInputPlaceholder: t("dataGrid.filterValue"),
    filterOperatorContains: t("dataGrid.contains"),
    filterOperatorEquals: t("dataGrid.equals"),
    filterOperatorStartsWith: t("dataGrid.startsWith"),
    filterOperatorEndsWith: t("dataGrid.endsWith"),
    filterOperatorIs: t("dataGrid.is"),
    filterOperatorNot: t("dataGrid.isNot"),
    filterOperatorIsEmpty: t("dataGrid.isEmpty"),
    filterOperatorIsNotEmpty: t("dataGrid.isNotEmpty"),
    filterOperatorIsAnyOf: t("dataGrid.isAnyOf"),
    filterValueAny: t("dataGrid.any"),
    filterValueTrue: t("dataGrid.true"),
    filterValueFalse: t("dataGrid.false"),
    columnMenuLabel: t("dataGrid.menu"),
    columnMenuShowColumns: t("dataGrid.columns"),
    columnMenuManageColumns: t("dataGrid.manageColumns"),
    columnMenuFilter: t("dataGrid.filter"),
    columnMenuHideColumn: t("dataGrid.hideColumn"),
    columnMenuUnsort: t("dataGrid.unsort"),
    columnMenuSortAsc: t("dataGrid.sortAscending"),
    columnMenuSortDesc: t("dataGrid.sortDescending"),
    columnHeaderFiltersTooltipActive: (count) => t("dataGrid.activeFilters", { count }),
    columnHeaderFiltersLabel: t("dataGrid.showFilters"),
    columnHeaderSortIconLabel: t("dataGrid.sort"),
    footerRowSelected: (count) => t("dataGrid.rowsSelected", { count }),
    footerTotalRows: t("dataGrid.totalRows"),
    footerTotalVisibleRows: (visible, total) => t("dataGrid.visibleRows", { visible, total }),
    checkboxSelectionSelectAllRows: t("dataGrid.selectAllRows"),
    checkboxSelectionUnselectAllRows: t("dataGrid.unselectAllRows"),
    checkboxSelectionSelectRow: t("dataGrid.selectRow"),
    checkboxSelectionUnselectRow: t("dataGrid.unselectRow"),
    actionsCellMore: t("dataGrid.more"),
    MuiTablePagination: {
      labelRowsPerPage: t("dataGrid.rowsPerPage"),
      labelDisplayedRows: ({ from, to, count }) => t(
        count === -1 ? "dataGrid.displayedRowsMore" : "dataGrid.displayedRows",
        { from, to, count }
      ),
      getItemAriaLabel: (type) => paginationLabel(t, type),
    },
    ...localeTextOverrides,
  }), [localeTextOverrides, t]);

  return (
    <DataGrid
      {...props}
      localeText={localeText}
      // DataGrid mengikuti tema; hanya strip DoubleBuffer bg yang perlu
      // diganggu jadi tembus pandang agar kartu gelap terlihat rapi.
      sx={{
        backgroundColor: "transparent",
        "--DataGrid-background": "transparent",
        "& .MuiDataGrid-cell": { borderColor: "divider" },
        "& .withBorder": { borderColor: "divider" },
        ...(props.sx || {}),
      }}
    />
  );
};

export default LocalizedDataGrid;
