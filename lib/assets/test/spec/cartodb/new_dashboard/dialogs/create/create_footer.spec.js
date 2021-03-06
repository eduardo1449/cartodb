var CreateFooterView = require('../../../../../../javascripts/cartodb/new_common/dialogs/create/create_footer');
var CreateModel = require('../../../../../../javascripts/cartodb/new_common/dialogs/create/create_model');
var MapTemplates = require('../../../../../../javascripts/cartodb/new_common/map_templates');
var UserUrl = require('../../../../../../javascripts/cartodb/new_common/urls/user_model');

describe('new_dashboard/dialog/create/create_footer_view', function() {
  beforeEach(function() {
    this.user = new cdb.admin.User({ username: 'paco' });

    this.currentUserUrl = new UserUrl({
      user: this.user,
      account_host: 'paco'
    });

    this.model = new CreateModel({
      type: "dataset",
      option: "listing"
    }, {
      user: this.user
    });

    this.view = new CreateFooterView({
      user: this.user,
      createModel: this.model,
      currentUserUrl: this.currentUserUrl
    });

    spyOn(this.model, 'bind').and.callThrough();

    this.view.render();
  });

  it('should not appear when option is templates', function() {
    this.model.set('option', 'templates');
    expect(this.view.$el.html()).toBe('');
  });

  it('should render a text info with two buttons when option is preview', function() {
    this.model.setMapTemplate(new cdb.core.Model(MapTemplates[0]));
    expect(this.view.$('.CreateDialog-footerInfo').length).toBe(1);
    expect(this.view.$('.CreateDialog-footerActions a').length).toBe(1);
    expect(this.view.$('.CreateDialog-footerActions button').length).toBe(1);
  });

  it('should have no leaks', function() {
    expect(this.view).toHaveNoLeaks();
  });

  afterEach(function() {
    this.view.clean();
  });
});
