import {
  from,
  merge,
  Notification,
  Observable,
  Subject,
  Subscription,
} from "rxjs";
import {
  switchMap,
  filter,
  tap,
  debounceTime,
  materialize,
} from "rxjs/operators";
import { action, makeObservable, observable } from "mobx";

export interface IFilter<T> {
  getFilter(): T;
  search$: Observable<void>;
}

export interface IFilterValue {
  checked: boolean;
}

export class FilterModel implements IFilter<IFilterValue> {
  filterState: IFilterValue = { checked: false };
  getFilter() {
    return this.filterState;
  }
  search$ = new Subject<void>();
  onChange<K extends keyof IFilterValue>(key: K, value: IFilterValue[K]): void {
    this.filterState[key] = value;
    this.search$.next();
  }
  constructor() {
    makeObservable(this, {
      filterState: observable.shallow,
      onChange: action.bound,
    });
  }
}

export class InputSearchModel implements IFilter<string> {
  keyword: string = "";
  getFilter(): string {
    return this.keyword;
  }
  showSearch: boolean = false;
  search$ = new Subject<void>();
  onInput(value: string) {
    if (value !== this.keyword) {
      this.keyword = value;
      if (value) {
        this.showSearch = true;
        this.search$.next();
      } else {
        this.showSearch = false;
      }
    }
  }
  onPressEnter() {
    this.showSearch = true;
    this.search$.next();
  }
  onHide() {
    this.showSearch = false;
  }
  constructor() {
    makeObservable(this, {
      keyword: observable.ref,
      showSearch: observable.ref,
      onInput: action.bound,
      onPressEnter: action.bound,
      onHide: action.bound,
    });
  }
}

function randomDelay() {
  return new Promise((rs) => {
    setTimeout(rs, Math.random() * 300);
  });
}

export class SearchResultModel {
  filterModel = new FilterModel();
  inputSearchModel = new InputSearchModel();
  refresh$ = new Subject<void>();
  get resultVisible() {
    return this.inputSearchModel.showSearch;
  }
  loading = false;
  error: Error | null = null;
  toggleLoading(v: boolean) {
    this.loading = v;
  }
  clear() {
    this.result = [];
    this.error = null;
  }

  fetch(): Promise<string[]> {
    const { filterModel, inputSearchModel } = this;
    const filterValue = {
      ...filterModel.getFilter(),
      keyword: inputSearchModel.getFilter(),
    };
    console.log("fetch:", filterValue);
    if (Math.random() > 0.8) {
      return Promise.reject(new Error("Some error happend"));
    }
    return randomDelay().then(() => {
      return [1, 2, 3, 4, 5].map(
        (num) =>
          `${filterValue.keyword} - ${num}|checked:${filterValue.checked}`
      );
    });
  }

  result: string[] = [];
  setResult(value: string[]) {
    this.result = value;
    this.error = null;
  }

  onRefresh() {
    this.refresh$.next();
  }

  handleResult(notification: Notification<string[]>): void {
    this.toggleLoading(false);
    if (this.resultVisible) {
      if (notification.error) {
        this.error = notification.error;
      }
      if (notification.value) {
        this.setResult(notification.value);
      }
    }
  }

  constructor() {
    makeObservable(this, {
      clear: action.bound,
      fetch: action.bound,
      result: observable.ref,
      error: observable.ref,
      setResult: action.bound,
      toggleLoading: action.bound,
      onRefresh: action.bound,
      handleResult: action.bound,
    });
  }

  connect(): () => void {
    const sub = new Subscription();
    const { filterModel, inputSearchModel } = this;
    const preSearchOperator = <T>(obs: Observable<T>): Observable<T> => {
      return obs.pipe(
        /**
         * 1. ?????????????????????????????????
         * 2. ??????????????????????????? - @eventTask
         */
        filter(() => this.resultVisible),
        tap(() => {
          // ??????????????????
          this.clear();
          this.toggleLoading(true);
        })
      );
    };
    sub.add(
      merge(
        /**
         * filter/refresh ???????????????????????????????????????????????????????????????????????????????????? debounce ???????????????
         * input ????????????????????????????????????????????? debounce ?????????????????????
         */
        this.refresh$.pipe(preSearchOperator, debounceTime(50)),
        filterModel.search$.pipe(preSearchOperator, debounceTime(50)),
        inputSearchModel.search$.pipe(preSearchOperator, debounceTime(200))
      )
        .pipe(
          // ?????? debounce ????????????????????????????????????????????????????????????(switchMap)???
          switchMap(() => {
            if (this.resultVisible) {
              /**
               * 1. debounce ???????????????????????????????????????????????????
               * 2. ??? debounceTime ?????????????????? timer ?????? - @macroTask
               */
              return from(this.fetch()).pipe(
                materialize(),
                tap((notification) => {
                  /**
                   * 1. ???????????????????????????????????????????????????????????????????????????
                   * 2. ??? Promise ?????? - @microTask
                   */
                  this.handleResult(notification);
                })
              );
            }
            this.toggleLoading(false);
            this.clear();
            return Promise.resolve();
          })
        )
        .subscribe()
    );
    return () => sub.unsubscribe();
  }
}
