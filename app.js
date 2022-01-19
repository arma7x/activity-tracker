const APP_VERSION = "1.0.0";
const TASK_TABLE = 'ACTIVE_TASK';
const ACTIVITY_TABLE = 'ACTIVITY_LOGS';
const CATEGORY_TABLE = 'CATEGORIES';
const DEFAULT_CATEGORY = {'id': 'General', 'name': 'General', 'text': 'General', color: '#320374'};

// {id, minute}
const setAlarm = function(data = {}) {
  return new Promise((resolve, reject) => {
    var date = new Date();
    date.setMinutes(date.getMinutes() + data.minute);
    console.log('Alarm set:', date.toString());
    var addRequest = navigator.mozAlarms.add(date, 'honorTimezone', data);
    addRequest.onsuccess = (res) => {
      resolve(res.target.result);
    };
    addRequest.onerrors = (err) => {
      reject(err);
    };
  });
}

const pushLocalNotification = function(title, body) {
  window.Notification.requestPermission()
  .then((result) => {
    var notification = new window.Notification(title, {
      body: body,
      requireInteraction: true
    });
    notification.onerror = function(err) {
      console.log(err);
    }
    notification.onclick = function(event) {
      if (window.navigator.mozApps) {
        var request = window.navigator.mozApps.getSelf();
        request.onsuccess = function() {
          if (request.result) {
            notification.close();
            request.result.launch();
          }
        };
      } else {
        window.open(document.location.origin, '_blank');
      }
    }
    notification.onshow = function() {
      // notification.close();
    }
  });
}

function forHumans(seconds, full = false) {
  var levels = [
    [Math.floor(seconds / 31536000), 'years'],
    [Math.floor((seconds % 31536000) / 86400), 'days'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
    [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
  ];
  var returntext = '';
  for (var i = 0, max = levels.length; i < max; i++) {
    if ( levels[i][0] === 0 ) continue;
    returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
  };
  if (full)
    return returntext.trim();
  const txts = returntext.trim().split(' ');
  return txts[0] + ' ' + txts[1];
}

window.addEventListener("load", function() {

  const state = new KaiState({
    [TASK_TABLE]: {},
    [ACTIVITY_TABLE]: {},
    [CATEGORY_TABLE]: {},
  });

  function insertTaskDB(obj) {
    return new Promise((resolve, reject) => {
      localforage.setItem(TASK_TABLE, obj)
      .then((updated_db) => {
        state.setState(TASK_TABLE, updated_db);
        resolve(updated_db);
      })
      .catch((err) => {
        reject(err);
      });
    });
  }

  function insertActivityDB(obj) {
    return new Promise((resolve, reject) => {
      localforage.getItem(ACTIVITY_TABLE)
      .then((old_db) => {
        if (old_db == null) {
          old_db = {};
        }
        old_db[obj.id] = obj;
        return localforage.setItem(ACTIVITY_TABLE, old_db);
      })
      .then((updated_db) => {
        state.setState(ACTIVITY_TABLE, updated_db);
        resolve(updated_db);
      })
      .catch((err) => {
        reject(err);
      });
    });
  }

  navigator.mozSetMessageHandler('alarm', (mozAlarm) => {
    console.log('Alarm fired:', mozAlarm);
    localforage.getItem(CATEGORY_TABLE)
    .then((categories) => {
      if (categories == null) {
        categories = {};
      }
      localforage.getItem(TASK_TABLE)
      .then((activity) => {
        if (activity == null) {
          activity = {};
        }
        if (Object.keys(activity).length > 0 && mozAlarm.data.id === activity.id) {
          var category = categories[activity['category']];
          if (category == null)
            category = DEFAULT_CATEGORY;
          pushLocalNotification(category.name, activity.description);
          setAlarm(mozAlarm.data)
          .then((alarm_id) => {
            activity['alarm_id'] = alarm_id;
            return insertTaskDB(activity);
          })
          .then((updated_activity) => {
            console.log('Update Activity:', updated_activity);
          })
          .catch((err) => {
            console.log(err.toString());
          })
        }
      });
    });
  });

  localforage.setDriver(localforage.INDEXEDDB);

  // init TASK_TABLE
  localforage.getItem(TASK_TABLE)
  .then((task) => {
    if (task == null) {
      task = {};
    }
    state.setState(TASK_TABLE, task);
  });

  // init ACTIVITY_TABLE
  localforage.getItem(ACTIVITY_TABLE)
  .then((db) => {
    if (db == null) {
      db = {};
    }
    state.setState(ACTIVITY_TABLE, db);
  });

  // init CATEGORY_TABLE
  localforage.getItem(CATEGORY_TABLE)
  .then((db) => {
    if (db == null) {
      db = {};
    }
    state.setState(CATEGORY_TABLE, db);
  });

  const dummy = new Kai({
    name: '_dummy_',
    data: {
      title: '_dummy_'
    },
    verticalNavClass: '.dummyNav',
    templateUrl: document.location.origin + '/templates/dummy.html',
    mounted: function() {},
    unmounted: function() {},
    methods: {},
    softKeyText: { left: 'L2', center: 'C2', right: 'R2' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  const changelogs = new Kai({
    name: 'changelogs',
    data: {
      title: 'changelogs'
    },
    templateUrl: document.location.origin + '/templates/changelogs.html',
    mounted: function() {
      this.$router.setHeaderTitle('Changelogs');
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const categoryEditor = function($router, category = null) {
    $router.push(
      new Kai({
        name: 'categoryEditor',
        data: {
          name: category ? category.name : '',
          color: category ? category.color : '',
        },
        verticalNavClass: '.editorCatNav',
        templateUrl: document.location.origin + '/templates/categoryEditor.html',
        mounted: function() {
          this.$router.setHeaderTitle('Category Editor');
        },
        unmounted: function() {},
        methods: {
          selected: function() {},
          randomColor: function() {
            return "#" + Math.floor(Math.random()*16777215).toString(16);
          },
          submit: function() {
            try {
              var _category = {
                id: category ? category.id : new Date().getTime(),
                name: this.data.name.trim(),
                color: this.data.color.trim(),
              }
              if (_category.name.length === 0 ) {
                $router.showToast('Name is required');
              } else if (_category.color.length === 0 ) {
                $router.showToast('Color is required');
              } else {
                localforage.getItem(CATEGORY_TABLE)
                .then((db) => {
                  if (db == null) {
                    db = {};
                  }
                  db[_category.id] = _category;
                  return localforage.setItem(CATEGORY_TABLE, db);
                })
                .then((updated_db) => {
                  $router.showToast(`Successfully ${category ? 'update' : 'add'} ${_category.name}`);
                  state.setState(CATEGORY_TABLE, updated_db);
                  $router.pop();
                });
              }
            } catch (e) {
              console.log(e.toString());
              $router.showToast('Error');
            }
          }
        },
        softKeyText: { left: 'Random', center: 'OK', right: 'Back' },
        softKeyListener: {
          left: function() {
            this.setData({ color: this.methods.randomColor() });
          },
          center: function() {
            const listNav = document.querySelectorAll(this.verticalNavClass);
            if (this.verticalNavIndex > -1) {
              if (listNav[this.verticalNavIndex]) {
                listNav[this.verticalNavIndex].click();
              }
            }
          },
          right: function() {
            $router.pop();
          }
        },
        softKeyInputFocusText: { left: '', center: '', right: 'Back' },
        softKeyInputFocusListener: {
          left: function() {},
          center: function() {},
          right: function() {
            $router.pop();
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            this.data.name = document.getElementById('name').value;
            this.data.color = document.getElementById('color').value;
            this.navigateListNav(-1);
          },
          arrowRight: function() {},
          arrowDown: function() {
            this.data.name = document.getElementById('name').value;
            this.data.color = document.getElementById('color').value;
            this.navigateListNav(1);
          },
          arrowLeft: function() {},
        }
      })
    );
  }

  const category = new Kai({
    name: '_category_',
    data: {
      title: 'category',
      categories: [],
    },
    verticalNavClass: '.catNav',
    templateUrl: document.location.origin + '/templates/category.html',
    mounted: function() {
      this.$router.setHeaderTitle('Manage Category');
      this.$state.addStateListener(CATEGORY_TABLE, this.methods.listenState);
      this.methods.listenState(this.$state.getState(CATEGORY_TABLE));
    },
    unmounted: function() {
      this.$state.removeStateListener(CATEGORY_TABLE, this.methods.listenState);
    },
    methods: {
      listenState: function(data) {
        const temp = [];
        if (data) {
          for (var x in data) {
            temp.push(data[x]);
          }
          this.setData({ categories: temp });
          this.methods.renderSoftKeyLR();
        }
      },
      renderSoftKeyLR: function () {
        if (this.data.categories.length > 0)
          this.$router.setSoftKeyLeftText('Edit') || this.$router.setSoftKeyRightText('Remove');
      }
    },
    softKeyText: { left: '', center: 'ADD', right: '' },
    softKeyListener: {
      left: function() {
        if (this.verticalNavIndex > -1 && this.data.categories.length > 0) {
          if (this.data.categories[this.verticalNavIndex]) {
            categoryEditor(this.$router, this.data.categories[this.verticalNavIndex]);
          }
        }
      },
      center: function() {
        categoryEditor(this.$router, null);
      },
      right: function() {
        if (this.verticalNavIndex > -1 && this.data.categories.length > 0) {
          if (this.data.categories[this.verticalNavIndex]) {
            const cat = this.data.categories[this.verticalNavIndex];
            this.$router.showDialog('Delete Confirmation', `<span>Are you sure to remove category <b>${cat.name}</b> ? All activities related to this category will be changed to <b>General</b> after this action was executed</span>`, null, 'Yes', () => {
              localforage.getItem(CATEGORY_TABLE)
              .then((db) => {
                if (db == null) {
                  db = {};
                }
                delete db[cat.id];
                return localforage.setItem(CATEGORY_TABLE, db);
              })
              .then((updated_db) => {
                this.verticalNavIndex--;
                this.$state.setState(CATEGORY_TABLE, updated_db);
                this.$router.showToast(`${cat.name} was deleted`);
              });
            }, 'No', () => {}, ' ', null, () => {
              setTimeout(() => {
                this.methods.renderSoftKeyLR();
              }, 100);
            });
          }
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0)
          return;
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.categories.length - 1)
          return
        this.navigateListNav(1);
      }
    }
  });

  const activityViewer = function($router, activity) {}

  const activitytEditor = function($router, activity = null, pushToDb = () => {return Promise.reject(0)}) {
    const mutable = activity ? activity.finish === 0 : true;
    const categories = [DEFAULT_CATEGORY];
    const loops = state.getState(CATEGORY_TABLE);
    for (var c in loops) {
      loops[c]['text'] = loops[c]['name'];
      categories.push(loops[c]);
    }
    $router.push(
      new Kai({
        name: 'activitytEditor',
        data: {
          description: activity ? activity.description : '',
          category: activity ? activity.category : categories[0],
          reminder: activity ? activity.reminder : 0,
          mutable: mutable,
          isEdit: activity !== null,
        },
        verticalNavClass: '.editorXtvtNav',
        templateUrl: document.location.origin + '/templates/activitytEditor.html',
        mounted: function() {
          this.$router.setHeaderTitle('Activity Editor');
        },
        unmounted: function() {},
        methods: {
          selectCategory: function() {
            const idx = categories.findIndex((opt) => {
              return opt.text === this.data.category.text;
            });
            this.$router.showSingleSelector('Category', categories, 'Select', (selected) => {
              this.setData({
                description: document.getElementById('description').value,
                reminder: document.getElementById('reminder') ? document.getElementById('reminder').value : 0,
                category: selected
              });
            }, 'Cancel', null, undefined, idx);
          },
          submit: function() {
            const t = new Date();
            var _activity = {
              id: activity ? activity.id : t.getTime(),
              description: this.data.description.trim(),
              category: this.data.category.id,
              reminder: parseInt(this.data.reminder.trim()),
              alarm_id: activity ? activity.alarm_id : 0,
              start: activity ? activity.start : t.getTime(),
              finish: activity ? activity.finish : 0,
              duration: activity ? activity.duration : 0,
            }
            if (_activity.description.length === 0 ) {
              $router.showToast('Description is required');
              return;
            }
            const minute = parseInt(this.data.reminder);
            if (isNaN(minute) || minute <= 0) {
              _activity['reminder'] = 0;
              navigator.mozAlarms.remove(_activity['alarm_id']);
              _activity['alarm_id'] = 0;
              this.methods.pushToDb(_activity);
            } else {
              setAlarm({ id: _activity.id, minute: minute})
              .then((alarm_id) => {
                _activity['alarm_id'] = alarm_id;
                this.methods.pushToDb(_activity);
              })
              .catch((err) => {
                console.log(err.toString());
                $router.showToast(err.toString());
              })
            }
          },
          pushToDb: function(obj) {
            try {
              pushToDb(obj)
              .then((updated_db) => {
                $router.showToast(`Successfully ${activity ? 'update' : 'add'} ${obj.id}`);
                $router.pop();
              })
              .catch((err) => {
                console.log(err.toString());
                $router.showToast(err.toString());
              })
            } catch (e) {
              console.log(e.toString());
              $router.showToast('Error');
            }
          }
        },
        softKeyText: { left: '', center: 'SELECT', right: 'Back' },
        softKeyListener: {
          left: function() {},
          center: function() {
            const listNav = document.querySelectorAll(this.verticalNavClass);
            if (this.verticalNavIndex > -1) {
              if (listNav[this.verticalNavIndex]) {
                listNav[this.verticalNavIndex].click();
              }
            }
          },
          right: function() {
            $router.pop();
          }
        },
        softKeyInputFocusText: { left: '', center: '', right: 'Back' },
        softKeyInputFocusListener: {
          left: function() {},
          center: function() {},
          right: function() {
            $router.pop();
          }
        },
        dPadNavListener: {
          arrowUp: function() {
            this.data.description = document.getElementById('description').value;
            this.data.reminder = document.getElementById('reminder') ? document.getElementById('reminder').value : 0;
            this.navigateListNav(-1);
          },
          arrowRight: function() {},
          arrowDown: function() {
            this.data.description = document.getElementById('description').value;
            this.data.reminder = document.getElementById('reminder') ? document.getElementById('reminder').value : 0;
            this.navigateListNav(1);
          },
          arrowLeft: function() {},
        }
      })
    );
  }

  const generateReport = function($router, type, start, end, categories = []) {
    // console.log(type, start, end, categories_obj);
    const pages = [];
    const reports = [];
    const list = [];
    const total_duration = {};
    const categories_obj = {};
    categories.forEach((c) => {
      categories_obj[c['id']] = c;
    });
    const activities = state.getState(ACTIVITY_TABLE);
    for (var x in activities) {
      if (categories_obj[activities[x]['category']] != null)
        activities[x]['category'] = categories_obj[activities[x]['category']];
      else
        activities[x]['category'] = categories_obj['General'];
      if (activities[x]['category']['checked'] && ((start === 0 || end === 0) || (start <= activities[x]['start'] && activities[x]['finish'] <= end))) {
        activities[x]['start'] = new Date(activities[x]['start']).toLocaleString();
        activities[x]['finish'] = new Date(activities[x]['finish']).toLocaleString();
        activities[x]['duration_txt'] = forHumans(Math.round(activities[x]['duration'] / 1000), true);
        list.push(activities[x]);
        if (total_duration[activities[x]['category']['name']] == null)
          total_duration[activities[x]['category']['name']] = 0;
        total_duration[activities[x]['category']['name']] += Math.round(activities[x]['duration'] / 1000);
      }
    }
    while (list.length > 0) {
      pages.push(list.splice(0, 1));
    }
    for (var x in total_duration) {
      reports.push({ text:x, subtext: forHumans(total_duration[x]) });
    }
    console.log(pages, reports);
  }
  const filterCategory = function($router, type, start, end, cb) {
    const general = JSON.parse(JSON.stringify(DEFAULT_CATEGORY));
    general['checked'] = true;
    const opts = [general];
    const temp_cats = state.getState(CATEGORY_TABLE);
    for (var x in temp_cats) {
      const c = temp_cats[x];
      c['text'] = c['name'];
      c['checked'] = true;
      opts.push(c);
    }
    setTimeout(() => {
      $router.showMultiSelector('Categories', opts, 'Select', null, 'Continue', (options) => {
        setTimeout(() => {
          const categories = []
          options.forEach((opt) => {
            if (opt.checked) {
              categories.push(opt);
            }
          });
          if (categories.length > 0) {
            generateReport($router, type, start, end, options);
          } else {
            $router.showToast('Please select a least one category');
          }
        }, 110);
      }, 'Cancel', null, () => {
        setTimeout(() => {
          cb();
        }, 100);
      }, 0);
    }, 110);
  }

  const advancedReport = new Kai({
    name: 'advancedReport',
    data: {
      title: 'advancedReport',
      start: '',
      start_ms: 0,
      end: '',
      end_ms: 0,
      categories: [],
    },
    verticalNavClass: '.advncdRprtNav',
    templateUrl: document.location.origin + '/templates/advancedReport.html',
    mounted: function() {
      this.$router.setHeaderTitle('Advanced Reports');
      var start = new Date();
      start.setHours(0);start.setMinutes(0);start.setSeconds(0);start.setMilliseconds(0);
      var end = new Date();
      end.setHours(23);end.setMinutes(59);end.setSeconds(59);end.setMilliseconds(999);
      this.setData({
        start: start.toLocaleDateString(),
        start_ms: start.getTime(),
        end: end.toLocaleDateString(),
        end_ms: end.getTime(),
      });
    },
    unmounted: function() {},
    methods: {
      setStart: function() {
        const d = new Date(this.data.start_ms);
        this.$router.showDatePicker(d.getFullYear(), d.getMonth() + 1, d.getDate(), (dt) => {
          this.setData({
            start: dt.toLocaleDateString(),
            start_ms: dt.getTime(),
          });
        }, undefined);
      },
      setEnd: function() {
        const d = new Date(this.data.end_ms);
        this.$router.showDatePicker(d.getFullYear(), d.getMonth() + 1, d.getDate(), (dt) => {
          dt.setHours(23);dt.setMinutes(59);dt.setSeconds(59);dt.setMilliseconds(999);
          this.setData({
            end: dt.toLocaleDateString(),
            end_ms: dt.getTime(),
          });
        }, undefined);
      },
    },
    softKeyText: { left: 'Category', center: 'SELECT', right: 'Return' },
    softKeyListener: {
      left: function() {
        if (this.data.start_ms > this.data.end_ms) {
          this.$router.showToast('Invalid datetime range');
        } else {
          filterCategory(this.$router, 'Advanced Reports', this.data.start_ms, this.data.end_ms, ()=>{});
        }
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          if (listNav[this.verticalNavIndex]) {
            listNav[this.verticalNavIndex].click();
          }
        }
      },
      right: function() {
        this.$router.pop();
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  const filterReportByType = function($router, type, cb) {
    switch (type) {
      case 'Today':
        var firstday = new Date();
        firstday.setHours(0);firstday.setMinutes(0);firstday.setSeconds(0);firstday.setMilliseconds(0);
        var lastday = new Date();
        lastday.setHours(23);lastday.setMinutes(59);lastday.setSeconds(59);lastday.setMilliseconds(999);
        filterCategory($router, type, firstday, lastday, cb);
        break;
      case 'This Week':
        var currentDate = new Date();
        var firstday = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
        firstday.setHours(0);firstday.setMinutes(0);firstday.setSeconds(0);firstday.setMilliseconds(0);
        var lastday = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 6));
        lastday.setHours(23);lastday.setMinutes(59);lastday.setSeconds(59);lastday.setMilliseconds(999);
        filterCategory($router, type, firstday, lastday, cb);
        break;
      case 'This Month':
        var date = new Date();
        var firstday = new Date(date.getFullYear(), date.getMonth(), 1);
        var lastday = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        lastday.setHours(23);lastday.setMinutes(59);lastday.setSeconds(59);lastday.setMilliseconds(999);
        filterCategory($router, type, firstday, lastday, cb);
        break;
      case 'This Year':
        var date = new Date();
        var firstday = new Date(date.getFullYear(), 0, 1);
        var lastday = new Date(date.getFullYear(), 11, 31);
        lastday.setHours(23);lastday.setMinutes(59);lastday.setSeconds(59);lastday.setMilliseconds(999);
        filterCategory($router, type, firstday, lastday, cb);
        break;
      case 'All Timeframe':
        filterCategory($router, type, 0, 0, cb);
        break;
      case 'Advanced Reports':
        $router.push('advancedReport');
        break;
    }
  }

  const Home = new Kai({
    name: 'home',
    data: {
      title: 'home',
      idle: true,
      active_task: {},
      date: '',
      reminder: false,
      reminder_str: '',
      elapsed: '',
    },
    verticalNavClass: '.homeNav',
    components: [],
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('Activity Logger');
      const CURRENT_VERSION = window.localStorage.getItem('APP_VERSION');
      if (APP_VERSION != CURRENT_VERSION) {
        this.$router.showToast(`Updated to version ${APP_VERSION}`);
        this.$router.push('changelogs');
        window.localStorage.setItem('APP_VERSION', APP_VERSION);
        return;
      }
      this.$state.addStateListener(TASK_TABLE, this.methods.listenState);
      this.methods.listenState(this.$state.getState(TASK_TABLE));
    },
    unmounted: function() {
      this.$state.removeStateListener(TASK_TABLE, this.methods.listenState);
    },
    methods: {
      listenState: function(data = {}) {
        localforage.getItem(CATEGORY_TABLE)
        .then((categories) => {
          if (Object.keys(data).length > 0) {
            if (categories == null) {
              categories = {};
            }
            categories['General'] = DEFAULT_CATEGORY;
            data['category'] = categories[data['category']];
            data['category']['text'] = data['category']['name'];
            const date = new Date(data['start']);
            this.setData({
              active_task: data,
              idle: Object.keys(data).length > 0 ? false : true,
              date: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
              reminder: data.alarm_id > 0 ? true : false,
              reminder_str: data.alarm_id > 0 ? forHumans(data['reminder'] * 60) : '',
              elapsed: timeago.format(data['start'])
            });
          } else {
            this.setData({ active_task: {}, idle: true, date: '', reminder: false, reminder_str: '', elapsed: '' });
          }
          this.methods.renderSoftKeyCR();
        });
      },
      renderSoftKeyCR: function () {
        if (!this.data.idle && this.$router.stack[this.$router.stack.length - 1].name === 'home')
          this.$router.setSoftKeyCenterText('ACTION') || this.$router.setSoftKeyRightText('FINISH');
        else if (this.data.idle && this.$router.stack[this.$router.stack.length - 1].name === 'home')
          this.$router.setSoftKeyCenterText('') || this.$router.setSoftKeyRightText('START');
      }
    },
    softKeyText: { left: 'Menu', center: '', right: '' },
    softKeyListener: {
      left: function() {
        var menu = [
          {'text': 'Manage Category'},
          {'text': 'Logs & Reports'},
          {'text': 'Changelogs'},
          {'text': 'Exit'},
        ]
        this.$router.showOptionMenu('Menu', menu, 'SELECT', (selected) => {
          if (selected.text === 'Changelogs') {
            this.$router.push('changelogs');
          } else if (selected.text === 'Manage Category') {
            this.$router.push('category');
          } else if (selected.text === 'Logs & Reports') {
            setTimeout(() => {
              var menu = [
                {'text': 'All Timeframe'},
                {'text': 'Today'},
                {'text': 'This Week'},
                {'text': 'This Month'},
                {'text': 'This Year'},
                {'text': 'Advanced Reports'},
              ]
              this.$router.showOptionMenu('Logs & Reports by', menu, 'SELECT', (selected) => {
                filterReportByType(this.$router, selected.text, this.methods.renderSoftKeyCR);
              }, () => {
                setTimeout(() => {
                  this.methods.renderSoftKeyCR();
                }, 100);
              });
            }, 110);
          } else if (selected.text === 'Exit') {
            window.close();
          }
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKeyCR();
          }, 100);
        });
      },
      center: function() {
        if (!this.data.idle) {
          var menu = [
            {'text': 'UPDATE'},
            {'text': 'CANCEL'},
          ]
          this.$router.showOptionMenu('ACTION', menu, 'SELECT', (selected) => {
            if (selected.text === 'UPDATE') {
              activitytEditor(this.$router, this.data.active_task, insertTaskDB)
            } else if (selected.text === 'CANCEL') {
              setTimeout(() => {
                this.$router.showDialog('CANCEL Confirmation', `<span>Are you sure to <b>CANCEL</b> this activity ?</span>`, null, 'Yes', () => {
                  insertTaskDB({})
                  .then((updated_db) => {
                    this.$router.showToast(`Successfully cancel activity`);
                  })
                  .catch((e) => {
                    console.log(e.toString());
                    this.$router.showToast('Error');
                  });
                }, 'No', () => {}, ' ', null, () => {
                  setTimeout(() => {
                    this.methods.renderSoftKeyCR();
                  }, 100);
                });
              }, 120);
            }
          }, () => {
            setTimeout(() => {
              this.methods.renderSoftKeyCR();
            }, 100);
          });
        }
      },
      right: function() {
        if (this.data.idle) {
          activitytEditor(this.$router, null, insertTaskDB);
        } else {
          this.$router.showDialog('STOP Confirmation', 'Are you sure this activity is complete ?', null, 'Yes', () => {
            localforage.getItem(TASK_TABLE)
            .then((cur_activity) => {
              navigator.mozAlarms.remove(cur_activity['alarm_id']);
              cur_activity['alarm_id'] = 0;
              cur_activity['finish'] = new Date().getTime();
              cur_activity['duration'] = cur_activity['finish'] - cur_activity['start'];
              return insertActivityDB(cur_activity);
            })
            .then(() => {
              return insertTaskDB({});
            })
            .then(() => {
              this.$router.showToast('Success');
            })
            .catch((e) => {
              console.log(e.toString());
              this.$router.showToast(e.toString());
            });
          }, 'No', () => {}, ' ', null, () => {
            setTimeout(() => {
              this.methods.renderSoftKeyCR();
            }, 100);
          });
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {},
      arrowDown: function() {}
    }
  });

  const router = new KaiRouter({
    title: 'Activity Logger',
    routes: {
      'index' : {
        name: 'Home',
        component: Home
      },
      'category' : {
        name: 'category',
        component: category
      },
      'advancedReport': {
        name: 'advancedReport',
        component: advancedReport
      },
      'changelogs' : {
        name: 'changelogs',
        component: changelogs
      }
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }

  function displayKaiAds() {
    return;
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'activity-logger',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
        ad.on('close', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
        ad.on('display', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
      }
    })
  }

  displayKaiAds();

  document.addEventListener('visibilitychange', function(ev) {
    if (document.visibilityState === 'visible') {
      displayKaiAds();
    }
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  .then(function(swReg) {
    // console.error('Service Worker Registered');
  })
  .catch(function(error) {
    // console.error('Service Worker Error', error);
  });
}
