package slideshow;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;

/**
 *
 * @author pwv
 */
public class SlideMenu extends JPopupMenu {

	Gui gui;
	
	public SlideMenu(Gui gui) {
		this.gui=gui;
		JMenuItem pause = new JMenuItem("Pause");
		this.add(pause);
		pause.addActionListener(new dosomething());
	}
	
	public class dosomething implements ActionListener {
		@Override
		public void actionPerformed(ActionEvent e) {
			JOptionPane.showMessageDialog(gui, 
			"Eggs are not supposed to be green.",
			e.getActionCommand(),
			JOptionPane.INFORMATION_MESSAGE);
		}
	}
}
