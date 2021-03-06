// Mock default behaviour for dependency, re-apply explicitly for tests where we want to test this mixin.
var DeleteItems = require('../../../../../javascripts/cartodb/new_dashboard/dialogs/delete_items_view');
var ViewModel = require('../../../../../javascripts/cartodb/new_dashboard/dialogs/delete_items_view_model');
var UserUrl = require('../../../../../javascripts/cartodb/new_common/urls/user_model');
var cdbAdmin = require('cdb.admin');

describe('new_dashboard/dialogs/delete_items_view', function() {
  beforeEach(function() {
    this.user = new cdbAdmin.User({
      id: 123,
      name: 'pepe'
    });

    this.currentUserUrl = new UserUrl({
      account_host: 'cartodb.com',
      user: this.user
    });

    this.contentType = 'datasets';

    this.models = [];
    this.createView = function() {
      this.viewModel = new ViewModel(this.models, {
        contentType: this.contentType
      });
      spyOn(this.viewModel, 'loadPrerequisites');
      this.view = new DeleteItems({
        user: this.user,
        viewModel: this.viewModel,
        currentUserUrl: this.currentUserUrl
      });
    };
  });

  it('should load prerequisites when creating the view', function() {
    this.createView();
    expect(this.viewModel.loadPrerequisites).toHaveBeenCalled();
  });

  describe('when loading prerequisites', function() {
    beforeEach(function() {
      this.createView();
      this.viewModel.setState('LoadingPrerequisites');
    });

    it('should show a message', function() {
      expect(this.innerHTML()).toContain('Checking what consequences deleting the selected datasets would have...');
    });

    describe('when loading prerequisites fails', function() {
      beforeEach(function() {
        this.viewModel.setState('LoadPrerequisitesFail');
      });

      it('should rendered the default error template', function() {
        expect(this.innerHTML()).toContain('ouch');
        expect(this.innerHTML()).toContain('error');
      });
    });

    describe('when loading prerequisities finished successfully', function() {
      beforeEach(function() {
        this.viewModel.setState('ConfirmDeletion');
      });

      it('should not render loader anymore', function() {
        expect(this.innerHTML()).not.toContain('Checking');
      });

      describe('when items are NOT shared with other users', function() {
        it('should not render any affected users block', function () {
          expect(this.innerHTML()).not.toContain('will loose access');
        });

        it('should render a text with amount of items to be deleted', function() {
          expect(this.innerHTML()).toContain('You are about to delete');
        });

        describe('when "OK, delete" button is clicked', function() {
          beforeEach(function() {
            spyOn(this.viewModel, 'deleteItems');
            spyOn(this.view, 'close').and.callThrough();
            this.view.$('.js-ok').click();
            this.viewModel.setState('DeletingItems');
          });

          it('should delete items', function() {
            expect(this.viewModel.deleteItems).toHaveBeenCalled();
          });

          describe('when deletion is done successfully', function() {
            beforeEach(function() {
              this.viewModel.setState('DeleteItemsDone');
            });

            it('should close the dialog', function() {
              expect(this.view.close).toHaveBeenCalled();
            });
          });

          describe('when deletion fails', function() {
            beforeEach(function() {
              this.viewModel.setState('DeleteItemsFail');
            });

            it('should show error message', function() {
              expect(this.innerHTML()).toContain('error');
            });
          });
        });
      });

      describe('when items are shared with other users', function() {
        beforeEach(function () {
          var newUser = function(opts) {
            return new cdbAdmin.User({
              id: opts.id,
              name: 'user name ' + opts.id
            });
          };
          spyOn(this.viewModel, 'affectedEntities').and.returnValue([
            newUser({ id: 1 }),
            newUser({ id: 2 }),
            newUser({ id: 3 }),
            newUser({ id: 4 })
          ]);

          this.viewModel.setState('ConfirmDeletion');
        });

        it('should render block of affected users', function() {
          expect(this.innerHTML()).toContain('Some users will loose access');
        });

        it('should show avatars of a sample of the affected users', function() {
          expect(this.innerHTML()).toContain('user name 1');
          expect(this.innerHTML()).toContain('user name 2');
          expect(this.innerHTML()).toContain('user name 3');

          // no more than 3 for now
          expect(this.innerHTML()).not.toContain('user name 4');
        });

        it('should show a "more" avatar representing that there are more users affected that are not displayed', function () {
          expect(this.innerHTML()).toContain('--moreItems');
        });
      });

      describe('when there are affected maps', function() {
        beforeEach(function() {
          this.mapUrl = jasmine.createSpyObj('MapUrl', ['toEdit']);
          this.mapUrl.toEdit.and.returnValue('http://pepe.cartodb.com/viz/abc-123/map');

          spyOn(this.currentUserUrl, 'mapUrl').and.returnValue(this.mapUrl);

          spyOn(this.viewModel, 'affectedVisData').and.returnValue([
            {
              id: '8b44c8ba-6fcf-11e4-8581-080027880ca6',
              name: 'A walk',
              updated_at: '2015-01-13T10:16:09+00:00',
              permission: {
                id: '7a3946ab-166e-4f55-af75-6964daf11fb2',
                owner: {
                  id: 'c07440fd-5dc2-4c82-9d58-ac8ba5a06ddf',
                  username: 'development',
                  avatar_url: '//gravatar.com/avatar/e28c025981d4f16551fff315fdffa498?s=128'
                }
              }
            }
          ]);

          this.viewModel.setState('ConfirmDeletion');
        });

        it('should render affected map', function() {
          expect(this.innerHTML()).toContain('MapCard');
        });

        it('should render the vizjson', function() {
          expect(this.innerHTML()).toContain('data-vizjson-url="/api/v2/viz/8b44c8ba-6fcf-11e4-8581-080027880ca6/viz.json"');
        });

        it('should be linked to open map in new window', function() {
          expect(this.innerHTML()).toContain('<a href="http://pepe.cartodb.com/viz/abc-123/map" target="_blank"');
        });
      });
    });
  });

  afterEach(function() {
    if (this.view) {
      this.view.clean();
    }
  });
});
