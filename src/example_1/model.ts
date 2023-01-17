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
         * 1. 只在搜索面板展示时生效
         * 2. 由用户行为直接触发 - @eventTask
         */
        filter(() => this.resultVisible),
        tap(() => {
          // 立即清空数据
          this.clear();
          this.toggleLoading(true);
        })
      );
    };
    sub.add(
      merge(
        /**
         * filter/refresh 触发的请求本身频率就不高，除非用户鼠标出现双击问题，因此 debounce 少一点就行
         * input 触发的请求频率高，所以用更长的 debounce 来缓解接口压力
         */
        this.refresh$.pipe(preSearchOperator, debounceTime(50)),
        filterModel.search$.pipe(preSearchOperator, debounceTime(50)),
        inputSearchModel.search$.pipe(preSearchOperator, debounceTime(200))
      )
        .pipe(
          // 如果 debounce 之后的新的搜索事件到来，则取消之前的请求(switchMap)。
          switchMap(() => {
            if (this.resultVisible) {
              /**
               * 1. debounce 之后如果面板还未被关闭，才发请求。
               * 2. 在 debounceTime 之后，因此由 timer 触发 - @macroTask
               */
              return from(this.fetch()).pipe(
                materialize(),
                tap((notification) => {
                  /**
                   * 1. 数据预加载完毕之后，如果面板还未关闭，才设置结果。
                   * 2. 由 Promise 触发 - @microTask
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
